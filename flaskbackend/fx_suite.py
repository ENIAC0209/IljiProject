# fx_suite.py
# - FX ensemble forecaster + FX/Tariff sales impact analyzer (Wide-format supported + DotDict fix)
from __future__ import annotations

import os
import math
import hashlib
import io
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

import numpy as np
import pandas as pd


# ✅ [핵심 수정 1] 딕셔너리를 obj.key로 접근 가능하게 하는 래퍼 클래스 정의
class DotDict(dict):
    """
    딕셔너리지만 obj.key 형태로 접근 가능하게 해주는 래퍼.
    app.py에서 속성 접근(Attribute Access)을 사용할 경우를 대비함.
    """
    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError:
            raise AttributeError(f"'DotDict' object has no attribute '{key}'")

    def __setattr__(self, key, value):
        self[key] = value


def _safe_float(x, default=0.0) -> float:
    try:
        if x is None:
            return default
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return default
        return v
    except Exception:
        return default


def _seed_from(*parts: str) -> int:
    s = "|".join([str(p) for p in parts])
    h = hashlib.md5(s.encode("utf-8")).hexdigest()[:8]
    return int(h, 16) & 0x7FFFFFFF


@dataclass
class FxForecastResult:
    ok: bool
    months: int
    last_actual: float
    rates: Dict[str, float]
    meta: Dict[str, float] = field(default_factory=dict)


class FXEnsembleForecaster:
    def __init__(
        self,
        fx_excel_path: Optional[str] = None,
        env_key: str = "FX_EXCEL_PATH",
        default_path: str = r".\usdkrw_5y_actual.xlsx",
    ):
        self.env_key = env_key
        p = (fx_excel_path or os.environ.get(env_key, "") or default_path or "").strip()
        self.fx_excel_path = os.path.abspath(p) if p else None

    def set_fx_excel_path(self, path: str):
        p = (path or "").strip()
        if not p:
            raise ValueError("환율 엑셀 파일 경로를 빈 값으로 설정할 수 없습니다.")
        self.fx_excel_path = os.path.abspath(self.fx_excel_path if path is None else path)

    def _load_monthly_series(self) -> pd.DataFrame:
        if not self.fx_excel_path:
            raise ValueError(f"환율 엑셀 경로가 설정되지 않았습니다. ({self.env_key})")
        if not os.path.exists(self.fx_excel_path):
            raise FileNotFoundError(f"환율 파일을 찾을 수 없습니다: {self.fx_excel_path}")

        try:
            df = pd.read_excel(self.fx_excel_path)
        except Exception:
            try:
                df = pd.read_csv(self.fx_excel_path, encoding="utf-8")
            except Exception:
                df = pd.read_csv(self.fx_excel_path, encoding="cp949")

        if "date" not in df.columns or "usdkrw" not in df.columns:
            raise ValueError("FX 파일에 'date', 'usdkrw' 컬럼이 필요합니다.")

        df = df.copy()
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").dropna(subset=["date", "usdkrw"])

        df["ym"] = df["date"].dt.to_period("M").astype(str)
        monthly = (
            df.groupby("ym", as_index=False)
            .agg(date=("date", "max"), usdkrw=("usdkrw", "last"))
            .sort_values("ym")
        )
        monthly["usdkrw"] = pd.to_numeric(monthly["usdkrw"], errors="coerce")
        monthly = monthly.dropna(subset=["usdkrw"]).reset_index(drop=True)
        return monthly

    @staticmethod
    def _stable_slope(x: np.ndarray, y: np.ndarray) -> float:
        x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)
        if len(x) < 2: return 0.0
        x_mean = float(x.mean())
        y_mean = float(y.mean())
        num = float(((x - x_mean) * (y - y_mean)).sum())
        den = float(((x - x_mean) ** 2).sum())
        if den == 0.0: return 0.0
        b = num / den
        return float(b) if np.isfinite(b) else 0.0

    def forecast(self, months: int = 12) -> FxForecastResult:
        months = int(months) if months is not None else 12
        if months <= 0: months = 12

        m = self._load_monthly_series()
        if len(m) < 6:
            last = float(m["usdkrw"].iloc[-1]) if len(m) else 1400.0
            yms = pd.period_range(pd.Period(m["ym"].iloc[-1]), periods=months + 1, freq="M")[1:]
            rates = {str(p): float(last) for p in yms}
            return FxForecastResult(ok=True, months=months, last_actual=last, rates=rates, meta={"model": "fallback_flat"})

        m["logp"] = np.log(m["usdkrw"].astype(float))
        m["r"] = m["logp"].diff()
        m = m.dropna(subset=["r"]).reset_index(drop=True)

        last_actual = float(m["usdkrw"].iloc[-1])
        last_ym = str(pd.Period(m["ym"].iloc[-1], freq="M"))
        last_logp = float(m["logp"].iloc[-1])

        win = min(36, len(m))
        y_tr = m["logp"].tail(win).values.astype(float)
        x_tr = np.arange(len(y_tr), dtype=float)
        level_trend = self._stable_slope(x_tr, y_tr)

        def mean_last(k: int) -> float:
            k = min(k, len(m))
            v = float(m["r"].tail(k).mean())
            return 0.0 if not np.isfinite(v) else v

        drift_3 = mean_last(3)
        drift_6 = mean_last(6)
        drift_12 = mean_last(12)

        m["month"] = pd.to_datetime(m["date"]).dt.month
        seas_map = m.groupby("month")["r"].mean().to_dict()
        seas_mean = float(np.mean(list(seas_map.values()))) if len(seas_map) else 0.0

        vol = float(m["r"].tail(min(12, len(m))).std())
        if not np.isfinite(vol) or vol <= 0: vol = 0.002

        rs = np.random.RandomState(_seed_from(last_ym, str(months)))
        w_d3, w_d6, w_d12 = 0.20, 0.30, 0.50

        yms = pd.period_range(pd.Period(last_ym, freq="M"), periods=months + 1, freq="M")[1:]
        preds: Dict[str, float] = {}
        cur_logp = last_logp

        for p in yms:
            mon = int(p.month)
            seas = float(seas_map.get(mon, 0.0))
            seas_adj = (seas - seas_mean) * 0.55
            drift = w_d3 * drift_3 + w_d6 * drift_6 + w_d12 * drift_12
            eps = float(rs.normal(loc=0.0, scale=vol * 0.45))
            eps = float(np.clip(eps, -vol * 1.25, vol * 1.25))
            r_hat = level_trend + drift + seas_adj + eps
            cur_logp = cur_logp + r_hat
            fx = float(np.exp(cur_logp))
            prev = last_actual if len(preds) == 0 else list(preds.values())[-1]
            fx = float(np.clip(fx, prev * 0.90, prev * 1.10))
            preds[str(p)] = round(fx, 4)

        return FxForecastResult(
            ok=True,
            months=months,
            last_actual=round(last_actual, 4),
            rates=preds,
            meta={"model": "ensemble", "vol": float(vol)},
        )


class FxTariffImpact:
    def __init__(self, *args, **kwargs):
        pass

    @staticmethod
    def _normalize_ym(x) -> Optional[str]:
        if pd.isna(x): return None
        s = str(x).strip()
        if not s: return None
        if len(s) == 7 and s[4] == "-":
            try:
                pd.Period(s, freq="M")
                return s
            except: pass
        digits = "".join(ch if ch.isdigit() else " " for ch in s).split()
        if len(digits) >= 2:
            y, m = digits[0], digits[1]
            if len(y) == 4:
                try: return f"{int(y):04d}-{int(m):02d}"
                except: pass
        if len(digits) == 1 and len(digits[0]) == 6:
            y, m = digits[0][:4], digits[0][4:]
            try: return f"{int(y):04d}-{int(m):02d}"
            except: pass
        return None

    @staticmethod
    def _read_sales_file(file_bytes: bytes) -> pd.DataFrame:
        try:
            return pd.read_excel(io.BytesIO(file_bytes), sheet_name=0)
        except Exception:
            try:
                return pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8")
            except UnicodeDecodeError:
                return pd.read_csv(io.BytesIO(file_bytes), encoding="cp949")

    @staticmethod
    def parse_sales_excel(file_bytes: bytes) -> pd.DataFrame:
        df = FxTariffImpact._read_sales_file(file_bytes)
        df = df.copy()
        df.columns = [str(c).strip() for c in df.columns]
        col_map = {str(c).strip().lower(): c for c in df.columns}

        def pick(*names: str) -> Optional[str]:
            for n in names:
                key = str(n).strip().lower()
                if key in col_map: return col_map[key]
            return None

        c_market = pick("유통경로명", "시장", "구분", "내수/직수출", "판매구분")
        c_currency = pick("단가적용통화", "통화", "currency")
        c_code = pick("자재코드", "품목코드", "material", "itemcode", "코드")
        c_name = pick("자재내역", "품목명", "materialtext", "itemname", "내역")
        c_car = pick("차종내역", "차종", "car", "차량")
        c_group = pick("자재그룹명", "자재그룹", "그룹", "group")
        c_plant = pick("플랜트명", "플랜트", "plant")

        if not c_market:
            raise ValueError("판매계획 파일에서 시장/유통경로 컬럼을 찾을 수 없습니다.")

        amount_cols = []
        for c in df.columns:
            cs = str(c).strip()
            if cs.endswith(" 금액(원화)"): continue
            if cs.endswith(" 금액"):
                head = cs[:-3].strip()
                if any(sep in head for sep in (".", "-", "/")) or (head.isdigit() and len(head) in (6, 7, 8)):
                    amount_cols.append(c)

        use_krw_amount = False
        if not amount_cols:
            krw_cols = [c for c in df.columns if str(c).strip().endswith(" 금액(원화)")]
            if krw_cols:
                amount_cols = krw_cols
                use_krw_amount = True

        if not amount_cols:
            raise ValueError("판매계획 파일에서 월별 금액 컬럼을 찾을 수 없습니다.")

        id_vars = [c for c in [c_market, c_currency, c_code, c_name, c_car, c_group, c_plant] if c is not None]
        
        melt = df[id_vars + amount_cols].melt(
            id_vars=id_vars, value_vars=amount_cols, var_name="ym_amount", value_name="amount"
        )

        out = pd.DataFrame()
        ym_raw = melt["ym_amount"].astype(str).str.replace("금액(원화)", "금액", regex=False)
        ym_raw = ym_raw.str.replace("금액", "", regex=False).str.strip()
        out["ym"] = ym_raw.apply(FxTariffImpact._normalize_ym)
        out["amount"] = pd.to_numeric(melt["amount"], errors="coerce").fillna(0.0)
        out["market"] = melt[c_market].astype(str).str.strip()
        
        if use_krw_amount:
            out["currency"] = "KRW"
        else:
            out["currency"] = melt[c_currency].astype(str).str.strip() if c_currency else "USD"

        # 🚨 안전 초기화 (KeyError 방지)
        empty_series = lambda: pd.Series("", index=melt.index, dtype=str)
        out["code"] = melt[c_code].astype(str).str.strip() if c_code else empty_series()
        out["name"] = melt[c_name].astype(str).str.strip() if c_name else empty_series()
        out["car"] = melt[c_car].astype(str).str.strip() if c_car else empty_series()
        out["group"] = melt[c_group].astype(str).str.strip() if c_group else empty_series()
        out["plant"] = melt[c_plant].astype(str).str.strip() if c_plant else empty_series()

        out = out.dropna(subset=["ym"])
        out = out[out["ym"].astype(str).str.len() == 7].reset_index(drop=True)
        out = out[out["amount"] > 0].reset_index(drop=True)
        return out

    @staticmethod
    def options(df: pd.DataFrame) -> Dict:
        # ✅ [핵심 수정 2] DotDict 적용
        data = {
            "ok": True,
            "options": {
                "cars": sorted([x for x in df.get("car", pd.Series(dtype=str)).dropna().unique().tolist() if x]),
                "plants": sorted([x for x in df.get("plant", pd.Series(dtype=str)).dropna().unique().tolist() if x]),
                "groups": sorted([x for x in df.get("group", pd.Series(dtype=str)).dropna().unique().tolist() if x]),
                "markets": sorted([x for x in df.get("market", pd.Series(dtype=str)).dropna().unique().tolist() if x]),
                "months": sorted(df.get("ym", pd.Series(dtype=str)).dropna().unique().tolist()),
            },
        }
        # Nested dict도 DotDict로 변환
        data['options'] = DotDict(data['options'])
        return DotDict(data)

    @staticmethod
    def extract_options(df: pd.DataFrame) -> Dict:
        return FxTariffImpact.options(df)

    @staticmethod
    def analyze(
        df: pd.DataFrame,
        tariff_pct: float,
        fx_mode: str,
        fx_change_pct: float,
        fx_forecast_rates: Optional[Dict[str, float]] = None,
        car: str = "",
        group: str = "",
        plant: str = "",
        market: str = "",
        ym_start: str = "",
        ym_end: str = "",
        q: str = "",
        search_column: str = "",
        search_value: str = "",
        limit_rows: int = 300,
    ) -> Dict:
        tariff_pct = _safe_float(tariff_pct, 0.0)
        fx_change_pct = _safe_float(fx_change_pct, 0.0)
        fx_mode = (fx_mode or "pct").strip().lower()

        required_cols = ["ym", "market", "currency", "amount"]
        missing_cols = [c for c in required_cols if c not in df.columns]
        if missing_cols:
            raise ValueError(f"분석용 DataFrame에 필수 컬럼 누락: {', '.join(missing_cols)}")

        d = df.copy()

        def is_valid_filter_val(val: str) -> bool:
            v = (val or "").strip()
            return v != "" and v.lower() not in ("전체", "all")

        if is_valid_filter_val(car): d = d[d.get("car", "") == car]
        if is_valid_filter_val(group): d = d[d.get("group", "") == group]
        if is_valid_filter_val(plant): d = d[d.get("plant", "") == plant]
        if is_valid_filter_val(market): d = d[d["market"] == market]
        if is_valid_filter_val(ym_start): d = d[d["ym"] >= ym_start.strip()]
        if is_valid_filter_val(ym_end): d = d[d["ym"] <= ym_end.strip()]

        if search_value:
            sv = str(search_value).strip()
            if sv:
                if search_column and search_column in d.columns:
                    d = d[d[search_column].astype(str).str.contains(sv, case=False, na=False)]
                else:
                    mask = (
                        d.get("code", "").astype(str).str.contains(sv, case=False, na=False)
                        | d.get("name", "").astype(str).str.contains(sv, case=False, na=False)
                        | d.get("car", "").astype(str).str.contains(sv, case=False, na=False)
                        | d.get("group", "").astype(str).str.contains(sv, case=False, na=False)
                        | d.get("plant", "").astype(str).str.contains(sv, case=False, na=False)
                    )
                    d = d[mask]
        elif q:
            qq = str(q).strip()
            if qq:
                mask = d.get("code", "").astype(str).str.contains(qq, case=False, na=False) | d.get("name", "").astype(str).str.contains(qq, case=False, na=False)
                d = d[mask]

        if d.empty or d["ym"].unique().size == 0:
            return DotDict({"ok": True, "summary": {}, "monthly_series": [], "rows": [], "breakdown": {}})

        months = sorted(d["ym"].unique().tolist())
        baseline_fx = 1400.0
        if fx_forecast_rates:
            baseline_fx = float(fx_forecast_rates.get(months[0], list(fx_forecast_rates.values())[0]))

        def fx_for_month(ym: str) -> float:
            if fx_mode == "auto" and fx_forecast_rates:
                return float(fx_forecast_rates.get(ym, baseline_fx))
            return baseline_fx * (1.0 + fx_change_pct / 100.0)

        d["fx_used"] = d["ym"].apply(fx_for_month)
        d["base_krw"] = np.where(d["currency"].astype(str).str.upper().eq("USD"), d["amount"] * baseline_fx, d["amount"])

        is_export = d["market"].astype(str).str.contains("직수출", na=False)
        is_domestic = ~is_export

        scenario_export = np.where(d["currency"].astype(str).str.upper().eq("USD"), d["amount"] * d["fx_used"], d["base_krw"])
        d["scenario_krw"] = np.where(is_export, scenario_export, d["base_krw"])
        d["delta_krw"] = d["scenario_krw"] - d["base_krw"]
        d["tariff_cost"] = np.where(is_export, d["scenario_krw"] * (tariff_pct / 100.0), 0.0)
        d["net_krw"] = d["scenario_krw"] - d["tariff_cost"]

        def sum_pack(sub: pd.DataFrame) -> Dict[str, float]:
            return DotDict({
                "base_krw": float(sub["base_krw"].sum()),
                "scenario_krw": float(sub["scenario_krw"].sum()),
                "delta_krw": float(sub["delta_krw"].sum()),
                "tariff_cost_krw": float(sub["tariff_cost"].sum()),
                "net_krw": float(sub["net_krw"].sum()),
            })

        total = sum_pack(d)
        dom = sum_pack(d[is_domestic])
        exp = sum_pack(d[is_export])

        monthly = []
        for ym in months:
            sub = d[d["ym"] == ym]
            sub_dom = sub[~sub["market"].astype(str).str.contains("직수출", na=False)]
            sub_exp = sub[sub["market"].astype(str).str.contains("직수출", na=False)]
            monthly.append({
                "ym": ym,
                "내수_base": float(sub_dom["base_krw"].sum()),
                "내수_net": float(sub_dom["net_krw"].sum()),
                "직수출_base": float(sub_exp["base_krw"].sum()),
                "직수출_net": float(sub_exp["net_krw"].sum())
            })

        d2 = d.copy()
        d2["abs_delta"] = d2["delta_krw"].abs()
        d2 = d2.sort_values("abs_delta", ascending=False).head(limit_rows)

        cols = ["ym", "market", "code", "name", "car", "group", "plant", "base_krw", "scenario_krw", "delta_krw", "tariff_cost", "net_krw"]
        for c in cols:
            if c not in d2.columns: d2[c] = "" if c in ("code","name","car","group","plant") else 0.0
        rows = d2[cols].to_dict("records")

        # ✅ [핵심 수정 3] analyze 결과도 DotDict로 반환
        return DotDict({
            "ok": True,
            "summary": {"total": total, "domestic": dom, "export": exp},
            "monthly_series": monthly,
            "rows": rows,
            "breakdown": {},
        })

# ---- backward compatible aliases
FxEnsembleForecaster = FXEnsembleForecaster
FxTariffAnalyzer = FxTariffImpact