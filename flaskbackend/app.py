# =========================
# app.py  (MODIFIED - 고정비/변동비/시즌·이벤트성만 표시)
#  - 기능/엔드포인트/로직은 그대로
#  - 심화분류(advancedMap)는 3개 값만 나오도록 정규화 + 필터
#  - /api/init-data 에 advancedMap 포함(프론트 배지 표시용)
#  - 누락되어 있던 유틸(_parse_year_month_from_upload_filename, _find_existing_pl_files_for_period) 추가
#  - ✅ (추가) 사유요약에 전월대비 변동% 포함
#  - ✅ (추가) 직전 3개월 유효값 있으면 12개월 언급 X / 없으면 12개월 유효값 O/X 표시
# =========================
from flask import Flask, jsonify, request
from flask_cors import CORS

import os
import re
import io
import sys
import pickle
import threading
import subprocess
import traceback
from datetime import datetime
from pathlib import Path
from typing import Tuple, Dict, Any, List, Optional

import pandas as pd
import numpy as np

# =====================================================
# ✅ [AUTH MODE SWITCH]
# =====================================================
USE_DB_AUTH = False  # ✅ 기본: 데모 모드
# USE_DB_AUTH = True  # ✅ DB 모드

# =========================
# 🔥 모듈 경로 강제 추가 (중요)
# =========================
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

# =========================
# ✅ cost_center pipeline imports
# =========================
from cost_center import (
    parse_cost_center_excel,   # (호환용) 필요시 사용
    detect_potential_missing,
    build_features,
    compute_corr_pairs,
    run_ensemble_outlier,
    build_human_explanations,
)

# =========================
# ✅ P&L Report (Topic3)
# =========================
from report_test import generate_pl_report_df
from pl_cause import analyze_pl_cause, list_available_periods

# =========================
# ✅ Topic4 Prophet (Forecast)
# =========================
from models.closing_forecast_model import (
    load_or_train,
    train_prophet_models,
    forecast_next_n,
)

# =========================
# ✅ DB / Auth
# =========================
import pymysql
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
CORS(app)

CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

COST_MONTHLY_DIR = BASE_DIR / "centercost_data"
BACKDATA_EXCEL_PATH = BASE_DIR / "3back_data_with_fake11_v2.xlsx"

REPORT_DATA_DIR = BASE_DIR / "report_data"
REPORT_DATA_DIR.mkdir(parents=True, exist_ok=True)

ADV_CLASS_XLSX_PATH = BASE_DIR / "코스트센터별_분류.xlsx"

# ✅ 서버 시작 시 1회 모델 로딩
forecast_payload = load_or_train()


def get_cache_path(name: str) -> str:
    return str(CACHE_DIR / name)


def get_connection():
    return pymysql.connect(
        host="192.168.2.186",
        user="shee",
        password="1111",
        db="iljitech",
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


# =====================================================
# ✅ 심화분류(고정비/변동비/시즌·이벤트성만 표시되게 정규화)
#  - 반환값을 3개로 "고정비", "변동비", "시즌/이벤트성"만 허용
#  - 그 외는 "" 로 처리 → 프론트에서 배지 미표시
# =====================================================
_ALLOWED_ADV = {"고정비", "변동비", "시즌/이벤트성"}


def _normalize_advanced(v) -> str:
    s = str(v or "").strip()
    if not s:
        return ""

    # 시즌/이벤트성 (표기 통일)
    if s in ("시즌/이벤트", "시즌", "이벤트", "시즌성", "시즌·이벤트성", "시즌/이벤트성"):
        return "시즌/이벤트성"

    # 고정비/변동비
    if s == "고정비":
        return "고정비"
    if s == "변동비":
        return "변동비"

    # 키워드 기반 보정
    if re.search(r"고정", s):
        return "고정비"
    if re.search(r"변동", s):
        return "변동비"
    if re.search(r"시즌|이벤트", s):
        return "시즌/이벤트성"

    # 그 외는 표시 안 함
    return ""


def load_advanced_class_map(use_cache: bool = True) -> Dict[str, Dict[str, str]]:
    """
    반환:
      {
        "byCcAcc": { "CC|ACC": "고정비|변동비|시즌/이벤트성" },
        "byAcc":   { "ACC": "고정비|변동비|시즌/이벤트성" }
      }
    """
    cache_path = get_cache_path("advanced_class_map.pkl")

    if use_cache and os.path.exists(cache_path):
        try:
            with open(cache_path, "rb") as f:
                payload = pickle.load(f)
            # ✅ 혹시 과거 캐시에 다른 값이 섞여 있어도 3개만 남김
            byCcAcc = {k: v for k, v in (payload.get("byCcAcc") or {}).items() if v in _ALLOWED_ADV}
            byAcc = {k: v for k, v in (payload.get("byAcc") or {}).items() if v in _ALLOWED_ADV}
            return {"byCcAcc": byCcAcc, "byAcc": byAcc}
        except Exception:
            pass

    if not ADV_CLASS_XLSX_PATH.exists():
        return {"byCcAcc": {}, "byAcc": {}}

    df = pd.read_excel(str(ADV_CLASS_XLSX_PATH))
    df = df.replace({np.nan: ""})

    def pick(row, keys):
        for k in keys:
            if k in row and str(row.get(k)).strip() != "":
                return row.get(k)
        return ""

    by_cc_acc: Dict[str, str] = {}
    by_acc: Dict[str, str] = {}

    for _, r in df.iterrows():
        row = r.to_dict()

        acc_raw = pick(row, ["계정코드", "account_code", "계정", "acc_code", "Code"])
        cc_raw = pick(row, ["코스트센터코드", "코스트센터", "CC", "cost_center", "코스트센터코드값"])
        cls_raw = pick(row, ["심화분류", "분류", "advanced", "class", "심화", "구분"])

        acc = str(acc_raw or "").strip()
        cc = str(cc_raw or "").strip()
        cls = _normalize_advanced(cls_raw)

        # ✅ 3개 외는 cls="" → 저장하지 않음
        if not acc or cls not in _ALLOWED_ADV:
            continue

        if acc not in by_acc:
            by_acc[acc] = cls

        if cc:
            by_cc_acc[f"{cc}|{acc}"] = cls

    payload = {"byCcAcc": by_cc_acc, "byAcc": by_acc}

    try:
        with open(cache_path, "wb") as f:
            pickle.dump(payload, f)
    except Exception:
        pass

    return payload


# =====================================================
# ✅ (수정) 사유 요약 생성 유틸: 전월대비 % 포함 + 3개월/12개월 유효값 룰
#  - 직전3개월 유효값 있으면: 12개월 언급 X
#  - 직전3개월 유효값 없으면: 직전12개월 유효값 O/X 표시
# =====================================================
def _summarize_reason(
    reason_kor: str,
    reason_tags,
    display_issue_type: str,
    mom_change_pct=None,
    lookback3_has_value: Optional[bool] = None,
    lookback12_has_value: Optional[bool] = None,
    *,
    zscore_12=None,
    dev_3m=None,
    iso_score=None,
    lof_score=None,
    corr_score=None,
) -> str:

    # -------------------------
    # 0) 공통 유틸
    # -------------------------
    def _ox(v):
        if v is True:
            return "O"
        if v is False:
            return "X"
        return "?"

    def _fmt_mom(pct):
        if pct is None or pd.isna(pct):
            return None
        try:
            v = float(pct)
            sign = "+" if v > 0 else ""
            return f"전월대비 {sign}{v:.1f}%"
        except Exception:
            return None

    def _as_list(x):
        if x is None:
            return []
        if isinstance(x, str):
            return [x]
        try:
            return list(x)
        except Exception:
            return []

    rk = str(reason_kor or "").strip()
    tags_in = _as_list(reason_tags)

    # -------------------------
    # 1) 태그/키워드 정규화 규칙
    #    - "reason_tags" + "reason_kor 문장" 모두에서 태그를 뽑아낸다
    # -------------------------
    TAG_MAP = {
        # 변동 방향/크기
        "급증": "급증", "상승": "급증", "increase": "급증",
        "급감": "급감", "하락": "급감", "decrease": "급감",

        # 결측/0
        "결측": "결측", "누락": "결측", "missing": "결측",
        "0값": "0값", "0 값": "0값", "제로": "0값",

        # 패턴/통계/모델
        "패턴이탈": "패턴이탈", "패턴 이탈": "패턴이탈",
        "밴드이탈": "패턴이탈", "band": "패턴이탈", "normal band": "패턴이탈",
        "zscore": "zscore", "z-score": "zscore", "z 점수": "zscore",
        "isolationforest": "IF", "isolation forest": "IF", "iforest": "IF",
        "lof": "LOF", "localoutlierfactor": "LOF", "local outlier factor": "LOF",
        "상관": "상관이상", "corr": "상관이상", "correlation": "상관이상",

        # 기타(필요하면 확장)
        "반복": "반복",
        "계절": "시즌", "시즌": "시즌", "이벤트": "이벤트",
    }

    # 요약에 보여줄 태그(너무 많아지면 가독성 떨어져서 제한)
    ORDER = ["결측", "0값", "급증", "급감", "패턴이탈", "zscore", "IF", "LOF", "상관이상", "반복", "시즌", "이벤트"]
    ALLOWED = set(ORDER)

    def _canonize(tag: str) -> Optional[str]:
        s = str(tag or "").strip()
        if not s:
            return None
        key = s.lower()
        canon = TAG_MAP.get(s, TAG_MAP.get(key, s))
        canon = str(canon).strip()
        return canon if canon in ALLOWED else None

    # 1-A) reason_tags에서 수집
    bag = []
    for t in tags_in:
        c = _canonize(t)
        if c:
            bag.append(c)

    # 1-B) reason_kor에서 키워드 자동 추출(문장에 단서가 있어도 태그로 승격)
    #     - 필요하면 여기 패턴만 계속 늘리면 됨
    rk_low = rk.lower()
    heuristics = [
        ("결측", [r"결측", r"누락", r"비어", r"없음", r"missing"]),
        ("0값",  [r"\b0\b", r"0원", r"영원", r"제로", r"0값"]),
        ("패턴이탈", [r"밴드", r"상한", r"하한", r"범위", r"pattern", r"패턴"]),
        ("zscore", [r"z\s*score", r"z-?score", r"z점수"]),
        ("IF", [r"isolation", r"iforest", r"iso"]),
        ("LOF", [r"\blof\b", r"local\s*outlier"]),
        ("상관이상", [r"상관", r"corr", r"correlation"]),
        ("반복", [r"주기", r"반복", r"격월", r"매월", r"분기"]),
        ("시즌", [r"계절", r"시즌"]),
        ("이벤트", [r"이벤트", r"명절", r"창립", r"연말", r"프로모션"]),
    ]
    for canon, pats in heuristics:
        for p in pats:
            if re.search(p, rk_low):
                bag.append(canon)
                break

    # 중복 제거 + 고정 순서로 정렬
    bag_set = set(bag)
    norm_tags = [t for t in ORDER if t in bag_set]

    # -------------------------
    # 2) 케이스별 "고정 포맷"으로 출력 (통일성 핵심)
    # -------------------------
       # (A) 누락: 유효값 룰만 깔끔히 + (결측/0값 태그가 있으면 같이)
    if display_issue_type == "누락":
        def _yn(v):
            if v is True:
                return "있음"
            if v is False:
                return "없음"
            return "확인필요"

        if lookback3_has_value is True:
            core = "누락 · 유효값 존재(이전 3개월 중)"
        elif lookback3_has_value is False:
            # 3개월 유효값 없을 때만 12개월 표기
            core = f"누락 · 유효값 존재(이전 3개월 중): {_yn(False)} · 유효값 존재(이전 12개월 중): {_yn(lookback12_has_value)}"
        else:
            core = "누락 · 유효값 존재(이전 3개월 중): 확인필요"

        # 누락 원인이 0인지 결측인지 같이 표기
        miss_tags = [t for t in norm_tags if t in ("결측", "0값")]
        if miss_tags:
            core += f" · 원인:{'/'.join(miss_tags)}"
        return core


    # (B) 이상/기타: "전월대비" + "태그(원인들)" + (없으면 reason_kor 한 줄 요약)
    parts = []
    mom_txt = _fmt_mom(mom_change_pct)
    if mom_txt:
        parts.append(mom_txt)

    # 누락용 태그(결측/0값)는 이상 케이스에서는 보통 노이즈라 제외 (원하면 유지 가능)
    show_tags = [t for t in norm_tags if t not in ("결측", "0값")]

    # -------------------------
    # ✅ 2-B) 태그별 영향도 점수 계산 → 큰 순서대로 정렬
    # -------------------------
    def _safe_abs(x):
        try:
            if x is None or pd.isna(x):
                return 0.0
            return abs(float(x))
        except Exception:
            return 0.0

    tag_score = {t: 0.0 for t in show_tags}

    # 급증/급감: 전월대비 % 절대값이 클수록 영향 큼
    mom_abs = _safe_abs(mom_change_pct)
    if "급증" in tag_score:
        tag_score["급증"] = max(tag_score["급증"], mom_abs)
    if "급감" in tag_score:
        tag_score["급감"] = max(tag_score["급감"], mom_abs)

    # zscore: abs(zscore_12)
    zs = _safe_abs(zscore_12)
    if "zscore" in tag_score:
        tag_score["zscore"] = max(tag_score["zscore"], zs)

    # 패턴이탈: dev_3m (네 파이프라인에서 이미 있음)
    dv = _safe_abs(dev_3m)
    if "패턴이탈" in tag_score:
        tag_score["패턴이탈"] = max(tag_score["패턴이탈"], dv)

    # IF / LOF: 점수 절대값(모델별 스케일 다르면 나중에 보정 가능)
    ifs = _safe_abs(iso_score)
    lofs = _safe_abs(lof_score)
    if "IF" in tag_score:
        tag_score["IF"] = max(tag_score["IF"], ifs)
    if "LOF" in tag_score:
        tag_score["LOF"] = max(tag_score["LOF"], lofs)

    # 상관이상: corr_score가 있으면 반영, 없으면 "있다" 수준으로 약한 점수
    cs = _safe_abs(corr_score)
    if "상관이상" in tag_score:
        tag_score["상관이상"] = max(tag_score["상관이상"], cs if cs > 0 else 0.5)

    # 반복/시즌/이벤트: 기본적으로 영향도 낮게(태그만 있으면 맨 뒤로 밀림)
    for low in ("반복", "시즌", "이벤트"):
        if low in tag_score and tag_score[low] == 0.0:
            tag_score[low] = 0.1

    # ✅ 점수 큰 순 → 동점이면 기존 ORDER 순서로 안정 정렬
    order_index = {k: i for i, k in enumerate(ORDER)}
    show_tags_sorted = sorted(
        show_tags,
        key=lambda t: (-tag_score.get(t, 0.0), order_index.get(t, 999)),
    )

    if show_tags_sorted:
        parts.append("원인 " + "/".join(show_tags_sorted))

    # 태그도 전월대비도 없으면, reason_kor 첫 문장 느낌만 짧게(너무 길면 컷)
    if not parts and rk:
        short = re.split(r"[.\n]", rk)[0].strip()
        if len(short) > 40:
            short = short[:40].rstrip() + "…"
        parts.append(short)

    return " · ".join(parts) if parts else ""




# =====================================================
# ✅ (추가) 전월 금액 / 전월대비 % 계산
#  - prev_amount: 바로 전월 금액
#  - mom_change_pct: (이번달-전월)/abs(전월)*100
#    * 전월이 0이면 None (무한대 방지)
# =====================================================
def add_mom_change(df: pd.DataFrame) -> pd.DataFrame:
    need = {"cost_center", "account_code", "year", "month", "amount"}
    miss = need - set(df.columns)
    if miss:
        # 기존 로직 깨지지 않게 그냥 반환
        return df

    df = df.copy().sort_values(["cost_center", "account_code", "year", "month"])
    df["prev_amount"] = df.groupby(["cost_center", "account_code"])["amount"].shift(1)

    def _calc(row):
        cur = row.get("amount")
        prev = row.get("prev_amount")
        if pd.isna(cur) or pd.isna(prev):
            return None
        try:
            prev_f = float(prev)
            cur_f = float(cur)
        except Exception:
            return None

        # ✅ 이번달이 0이면 전월대비 계산/표시 안 함
        if cur_f == 0.0:
            return None

        # ✅ 전월이 0이면 분모 문제라 None
        if prev_f == 0.0:
            return None

        return (cur_f - prev_f) / abs(prev_f) * 100.0

    df["mom_change_pct"] = df.apply(_calc, axis=1)
    return df


# =====================================================
# ✅ (추가) 직전 3개월/12개월 유효값 존재 여부
#  - 유효값 = NaN 아님 & 0 아님
# =====================================================
def add_lookback_valid_flags(df: pd.DataFrame) -> pd.DataFrame:
    need = {"cost_center", "account_code", "year", "month", "amount"}
    if (need - set(df.columns)):
        return df

    df = df.copy().sort_values(["cost_center", "account_code", "year", "month"])

    def _is_valid(x):
        if pd.isna(x):
            return False
        try:
            return float(x) != 0.0
        except Exception:
            return False

    df["_valid_amt"] = df["amount"].apply(_is_valid)

    # 그룹별로 "현재월 제외"를 위해 shift(1) 후 rolling max
    def _calc_flags(g):
        pv = g["_valid_amt"].shift(1).fillna(False)
        g["lookback3_has_value"] = pv.rolling(3, min_periods=1).max().astype(bool)
        g["lookback12_has_value"] = pv.rolling(12, min_periods=1).max().astype(bool)
        return g

    df = df.groupby(["cost_center", "account_code"], group_keys=False).apply(_calc_flags)

    df.drop(columns=["_valid_amt"], inplace=True, errors="ignore")
    return df



# =====================================================
# 유틸: 파일명에서 연/월 추출 (통합보고서 파일명용)
# =====================================================
def _parse_year_month_from_report_filename(path: Path) -> Optional[Tuple[int, int]]:
    name = path.name
    m = re.search(r"(\d{2})년[_\s](\d{2})월", name)
    if not m:
        return None
    yy = int(m.group(1))
    mm = int(m.group(2))
    if not (1 <= mm <= 12):
        return None
    year = 2000 + yy
    return year, mm


# =====================================================
# 유틸: 업로드 파일명에서 연/월 추출 (back_data 업로드용)
# =====================================================
def _parse_year_month_from_upload_filename(filename: str) -> Optional[Tuple[int, int]]:
    s = str(filename or "")

    m1 = re.search(r"(20\d{2})\s*년\D*([0-1]?\d)\s*월", s)
    if m1:
        y = int(m1.group(1))
        m = int(m1.group(2))
        if 1 <= m <= 12:
            return (y, m)

    m2 = re.search(r"(\d{2})\s*년[_\s-]*([0-1]?\d)\s*월", s)
    if m2:
        yy = int(m2.group(1))
        m = int(m2.group(2))
        if 1 <= m <= 12:
            return (2000 + yy, m)

    m3 = re.search(r"(20\d{2})([0-1]\d)", s)
    if m3:
        y = int(m3.group(1))
        m = int(m3.group(2))
        if 1 <= m <= 12:
            return (y, m)

    m4 = re.search(r"(\d{2})([0-1]\d)", s)
    if m4 and "20" not in s:
        yy = int(m4.group(1))
        m = int(m4.group(2))
        if 1 <= m <= 12:
            return (2000 + yy, m)

    return None


def _find_existing_pl_files_for_period(year: int, month: int) -> Dict[str, List[Path]]:
    REPORT_DATA_DIR.mkdir(parents=True, exist_ok=True)
    yy2 = year % 100

    report_pattern = f"{yy2:02d}년_{month:02d}월*결산보고서_통합*.xlsx"
    reports = list(REPORT_DATA_DIR.glob(report_pattern))

    back_pattern = f"{yy2:02d}년_{month:02d}월*back*.xlsx"
    backs = list(REPORT_DATA_DIR.glob(back_pattern))

    reports += list(REPORT_DATA_DIR.glob(f"{year}년*{month:02d}월*결산보고서_통합*.xlsx"))
    backs += list(REPORT_DATA_DIR.glob(f"{year}년*{month:02d}월*back*.xlsx"))

    return {
        "reports": sorted(set(reports), key=lambda p: p.stat().st_mtime, reverse=True),
        "backs": sorted(set(backs), key=lambda p: p.stat().st_mtime, reverse=True),
    }


# =====================================================
# Health
# =====================================================
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})


# =====================================================
# Auth
# =====================================================
@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}

    username = (data.get("username") or data.get("userId") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"success": False, "message": "아이디와 비밀번호를 입력해주세요."}), 400

    if not USE_DB_AUTH:
        return jsonify(
            {
                "success": True,
                "user": {"id": 0, "username": username, "role": "demo"},
                "mode": "demo_no_db",
            }
        ), 200

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, password_hash, role
                FROM users
                WHERE username = %s
                LIMIT 1
                """,
                (username,),
            )
            user = cur.fetchone()
    except Exception as e:
        print("[/api/login] DB error:", e)
        return jsonify({"success": False, "message": "로그인 중 서버 오류가 발생했습니다."}), 500
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"success": False, "message": "아이디 또는 비밀번호가 올바르지 않습니다."}), 401

    return jsonify(
        {
            "success": True,
            "user": {"id": user["id"], "username": user["username"], "role": user.get("role", "user")},
            "mode": "db",
        }
    ), 200


@app.route("/api/signup", methods=["POST"])
def api_signup():
    data = request.get_json() or {}

    user_id = (data.get("userId") or data.get("username") or "").strip()
    password = data.get("password") or ""

    if not user_id or not password:
        return jsonify({"success": False, "message": "아이디와 비밀번호를 입력해주세요."}), 400

    if not USE_DB_AUTH:
        return jsonify({"success": True, "message": "회원가입이 완료되었습니다. (데모/DB 미사용)"}), 200

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username = %s LIMIT 1", (user_id,))
            exists = cur.fetchone()
            if exists:
                return jsonify({"success": False, "message": "이미 사용 중인 아이디입니다."}), 400

            pw_hash = generate_password_hash(password)
            cur.execute(
                """
                INSERT INTO users (username, password_hash, role)
                VALUES (%s, %s, %s)
                """,
                (user_id, pw_hash, "user"),
            )
            conn.commit()
    except Exception as e:
        print("[/api/signup] DB error:", e)
        return jsonify({"success": False, "message": "회원가입 중 서버 오류가 발생했습니다."}), 500
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass

    return jsonify({"success": True, "message": "회원가입이 완료되었습니다."}), 200


@app.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    identifier = (data.get("userIdOrEmail") or "").strip()

    if not identifier:
        return jsonify({"success": False, "message": "아이디 또는 이메일을 입력해주세요."}), 400

    if not USE_DB_AUTH:
        return jsonify({"success": True, "message": "재설정 링크를 전송했다고 가정합니다. (데모/DB 미사용)"}), 200

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username = %s LIMIT 1", (identifier,))
            user = cur.fetchone()
    except Exception as e:
        print("[/api/reset-password] DB error:", e)
        return jsonify({"success": False, "message": "비밀번호 재설정 중 서버 오류가 발생했습니다."}), 500
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass

    if not user:
        return jsonify({"success": False, "message": "해당 아이디(또는 이메일)를 사용하는 사용자를 찾을 수 없습니다."}), 404

    return jsonify({"success": True, "message": "재설정 링크를 전송했다고 가정합니다."}), 200


# =====================================================
# 4. 단일 월 업로드 엑셀 파싱 (유연 파서)
# =====================================================
def _normalize_year_month_label(label: str) -> Tuple[str, int, int]:
    s = str(label)
    m = re.search(r"(20\d{2})[^0-9]*([0-1]?\d)", s)
    if not m:
        raise ValueError(f"연-월 정보를 찾을 수 없습니다: {label}")
    year = int(m.group(1))
    month = int(m.group(2))
    ym = f"{year:04d}-{month:02d}"
    return ym, year, month


def parse_single_month_excel(file_stream: io.BytesIO) -> pd.DataFrame:
    raw = pd.read_excel(file_stream, header=None)

    if raw.shape[1] < 5:
        raise ValueError("예상보다 적은 컬럼 수입니다. 업로드 양식을 확인하세요.")

    header = raw.iloc[0]
    header_str = header.astype(str)

    month_col_idx = None
    for i, v in enumerate(header_str):
        if re.search(r"20\d{2}\s*년\s*\d{1,2}\s*월", v):
            month_col_idx = i
            break
    if month_col_idx is None:
        month_col_idx = raw.shape[1] - 1

    month_label = header.iloc[month_col_idx]
    year_month, year, month = _normalize_year_month_label(month_label)

    df = raw.iloc[1:].copy()

    def find_col(keyword_list, default_idx):
        for i, v in enumerate(header_str):
            for kw in keyword_list:
                if kw in v:
                    return i
        return default_idx

    cc_code_idx = find_col(["코스트센터코드", "코스트센터 코드", "코스트센터"], 0)
    cc_name_idx = find_col(["코스트센터명", "코스트센터 명"], 1)
    acc_code_idx = find_col(["계정코드", "계정 코드"], 2)
    acc_name_idx = find_col(["계정명", "계정 명"], 3)

    rename_map = {
        cc_code_idx: "cost_center",
        cc_name_idx: "cc_name",
        acc_code_idx: "account_code",
        acc_name_idx: "account_name",
        month_col_idx: "amount",
    }

    df = df.rename(columns=rename_map)

    needed_cols = ["cost_center", "cc_name", "account_code", "account_name", "amount"]
    missing = [c for c in needed_cols if c not in df.columns]
    if missing:
        raise ValueError(f"필수 컬럼이 누락되었습니다: {', '.join(missing)}")

    df = df[needed_cols]

    for col in ["cost_center", "cc_name", "account_code", "account_name"]:
        df[col] = df[col].astype(str).str.strip()

    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")

    df["year_month"] = year_month
    df["year"] = year
    df["month"] = month

    if "cost_nature" not in df.columns:
        df["cost_nature"] = "기타"

    df = df[df["cost_center"].notna() & (df["cost_center"].astype(str) != "nan")]
    return df.reset_index(drop=True)


# =====================================================
# 1-A. 월별 엑셀 여러 개를 long 포맷으로 로딩
# =====================================================
def load_all_monthly_cost_long() -> pd.DataFrame:
    if not COST_MONTHLY_DIR.exists():
        raise FileNotFoundError(f"월별 코스트센터 폴더가 없습니다: {COST_MONTHLY_DIR}")

    all_dfs: List[pd.DataFrame] = []

    for fname in sorted(os.listdir(str(COST_MONTHLY_DIR))):
        if not fname.lower().endswith((".xlsx", ".xls")):
            continue
        fpath = COST_MONTHLY_DIR / fname
        try:
            with open(fpath, "rb") as f:
                data = f.read()
            df = parse_single_month_excel(io.BytesIO(data))
            df["source_file"] = fname
            all_dfs.append(df)
            print(f"[load_all_monthly_cost_long] loaded {fname}, rows={len(df)}")
        except Exception as e:
            print(f"[load_all_monthly_cost_long] {fname} 읽는 중 오류:", e)

    if not all_dfs:
        raise ValueError(f"{COST_MONTHLY_DIR} 안에서 유효한 월별 엑셀(.xlsx/.xls)을 찾지 못했습니다.")

    df_all = pd.concat(all_dfs, ignore_index=True)

    if "year" not in df_all.columns or "month" not in df_all.columns:
        raise ValueError("월별 데이터에 year/month 컬럼이 없습니다.")

    df_all["year_month"] = df_all["year_month"].astype(str)
    df_all = df_all.sort_values(["year", "month"]).reset_index(drop=True)

    if "cost_nature" not in df_all.columns:
        df_all["cost_nature"] = "기타"

    return df_all


def build_wide_cost_data(df: pd.DataFrame) -> pd.DataFrame:
    required_cols = ["cost_center", "cc_name", "account_code", "account_name", "year_month", "amount"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError("build_wide_cost_data: missing columns: " + ", ".join(missing))

    df_use = df[required_cols].copy()
    for col in ["cost_center", "cc_name", "account_code", "account_name", "year_month"]:
        df_use[col] = df_use[col].astype(str)

    pivot = (
        df_use.pivot_table(
            index=["cost_center", "cc_name", "account_code", "account_name"],
            columns="year_month",
            values="amount",
            aggfunc="sum",
            fill_value=0.0,
        )
        .reset_index()
    )

    pivot.columns = [str(c) for c in pivot.columns]

    if "cc_name" in pivot.columns:
        if "코스트센터명" not in pivot.columns:
            idx = pivot.columns.get_loc("cc_name") + 1
            pivot.insert(idx, "코스트센터명", pivot["cc_name"])
        if "부서명" not in pivot.columns:
            idx2 = pivot.columns.get_loc("코스트센터명") + 1 if "코스트센터명" in pivot.columns else pivot.columns.get_loc("cc_name") + 1
            pivot.insert(idx2, "부서명", pivot["cc_name"])

    if "cost_center" in pivot.columns and "코스트센터" not in pivot.columns:
        idx = pivot.columns.get_loc("cost_center") + 1
        pivot.insert(idx, "코스트센터", pivot["cost_center"])

    return pivot


def load_cost_center_data(use_cache: bool = True) -> pd.DataFrame:
    cache_path = get_cache_path("costData_wide.pkl")

    if use_cache and os.path.exists(cache_path):
        try:
            df_wide = pd.read_pickle(cache_path)
            print("[load_cost_center_data] loaded from cache:", cache_path)
            return df_wide
        except Exception as e:
            print("[load_cost_center_data] cache load error, 재계산:", e)

    df_long = load_all_monthly_cost_long()
    df_wide = build_wide_cost_data(df_long)

    try:
        df_wide.to_pickle(cache_path)
        print("[load_cost_center_data] saved cache:", cache_path)
    except Exception as e:
        print("[load_cost_center_data] cache save error:", e)

    return df_wide


def load_pl_backdata():
    if not BACKDATA_EXCEL_PATH.exists():
        raise FileNotFoundError(f"Backdata file not found: {BACKDATA_EXCEL_PATH}")

    xls = pd.ExcelFile(str(BACKDATA_EXCEL_PATH))
    print("[load_pl_backdata] sheet names:", xls.sheet_names)

    back_sheet_name = None
    for name in xls.sheet_names:
        if re.search(r"back\s*data", name, re.IGNORECASE):
            back_sheet_name = name
            break
    if back_sheet_name is None:
        back_sheet_name = xls.sheet_names[0]

    df_back = pd.read_excel(xls, sheet_name=back_sheet_name)
    df_back = df_back.replace({np.nan: None})
    back_records = df_back.to_dict(orient="records")

    codeNameMap: Dict[str, str] = {}
    mapping_sheet_name = None
    for name in xls.sheet_names:
        if re.search(r"코드분류표|code.?map|코드맵", name, re.IGNORECASE):
            mapping_sheet_name = name
            break

    if mapping_sheet_name is not None:
        df_map = pd.read_excel(xls, sheet_name=mapping_sheet_name)
        for _, row in df_map.iterrows():
            rawCode = (
                (row.get("코드") if "코드" in row else None)
                or (row.get("계정코드") if "계정코드" in row else None)
                or (row.get("코스트센터") if "코스트센터" in row else None)
                or (row.get("코드값") if "코드값" in row else None)
                or (row.get("Code") if "Code" in row else None)
            )
            rawName = (
                (row.get("내역") if "내역" in row else None)
                or (row.get("계정명") if "계정명" in row else None)
                or (row.get("코스트센터명") if "코스트센터명" in row else None)
                or (row.get("Name") if "Name" in row else None)
                or (row.get("설명") if "설명" in row else None)
            )

            if rawCode is None or rawName is None:
                continue
            if pd.isna(rawCode) or pd.isna(rawName):
                continue

            code = str(rawCode).strip()
            name = str(rawName).strip()
            if code:
                codeNameMap[code] = name

    return back_records, codeNameMap


@app.route("/api/init-data", methods=["GET"])
def init_data():
    try:
        df_cost = load_cost_center_data(use_cache=True)
        costData = df_cost.to_dict(orient="records")
    except Exception as e:
        print("[init-data] costData load error:", e)
        costData = []

    try:
        backData, codeNameMap = load_pl_backdata()
    except Exception as e:
        print("[init-data] backData load error:", e)
        backData = []
        codeNameMap = {}

    try:
        advancedMap = load_advanced_class_map(use_cache=True)
    except Exception as e:
        print("[init-data] advancedMap load error:", e)
        advancedMap = {"byCcAcc": {}, "byAcc": {}}

    anomalyData: List[Dict[str, Any]] = []
    return jsonify(
        {
            "costData": costData,
            "backData": backData,
            "codeNameMap": codeNameMap,
            "anomalyData": anomalyData,
            "advancedMap": advancedMap,
        }
    )


def build_history_map(df: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
    hist: Dict[str, List[Dict[str, Any]]] = {}
    df = df.copy()
    df["year_month"] = df["year_month"].astype(str)

    has_upper = "normal_upper" in df.columns
    has_lower = "normal_lower" in df.columns
    has_flag = "anomaly_flag" in df.columns

    for (cc, acc), grp in df.groupby(["cost_center", "account_code"], dropna=False):
        key = f"{cc}|{acc}"
        grp_sorted = grp.sort_values("year_month")

        records: List[Dict[str, Any]] = []
        for _, row in grp_sorted.iterrows():
            ym = str(row.get("year_month"))
            amt = row.get("amount")

            nu = row.get("normal_upper") if has_upper else None
            nl = row.get("normal_lower") if has_lower else None
            af = bool(row.get("anomaly_flag", False)) if has_flag else False

            records.append(
                {
                    "month": ym,
                    "amount": float(amt) if pd.notna(amt) else None,
                    "normalUpper": float(nu) if (nu is not None and pd.notna(nu)) else None,
                    "normalLower": float(nl) if (nl is not None and pd.notna(nl)) else None,
                    "anomalyFlag": af,
                }
            )

        hist[key] = records

    return hist


def add_normal_band(df: pd.DataFrame, window: int = 6, min_periods: int = 1) -> pd.DataFrame:
    if "amount" not in df.columns:
        raise ValueError("add_normal_band: 'amount' 컬럼이 없습니다.")
    for col in ["year", "month"]:
        if col not in df.columns:
            raise ValueError(f"add_normal_band: '{col}' 컬럼이 없습니다.")

    df = df.copy()
    df = df.sort_values(["cost_center", "account_code", "year", "month"])
    df["normal_upper"] = np.nan
    df["normal_lower"] = np.nan

    has_flag = "anomaly_flag" in df.columns

    for (cc, acc), grp in df.groupby(["cost_center", "account_code"], dropna=False):
        vals = grp["amount"].astype(float)

        if has_flag:
            flag = grp["anomaly_flag"].astype(bool)
            valid_vals = vals.where(~flag, np.nan)
        else:
            valid_vals = vals

        roll_mean = valid_vals.rolling(window=window, min_periods=min_periods).mean()
        roll_std = valid_vals.rolling(window=window, min_periods=min_periods).std(ddof=0)

        fallback_mean = vals.rolling(window=window, min_periods=min_periods).mean()
        fallback_std = vals.rolling(window=window, min_periods=min_periods).std(ddof=0)

        mean_final = roll_mean.fillna(fallback_mean)
        std_final = roll_std.fillna(fallback_std)

        upper = mean_final + 2 * std_final
        lower = mean_final - 2 * std_final

        df.loc[grp.index, "normal_upper"] = upper.values
        df.loc[grp.index, "normal_lower"] = lower.values

    return df


def run_monthly_anomaly_pipeline(upload_df: pd.DataFrame) -> Dict[str, Any]:
    if upload_df.empty:
        raise ValueError("업로드된 데이터에 내용이 없습니다.")

    target_ym = upload_df["year_month"].iloc[0]

    base_df = load_all_monthly_cost_long()
    base_df = base_df[base_df["year_month"] != target_ym].copy()
    df_all = pd.concat([base_df, upload_df], ignore_index=True)

    df_all = detect_potential_missing(df_all, lookback_months=3)
    df_all = build_features(df_all)
    df_all = compute_corr_pairs(df_all)
    df_all = run_ensemble_outlier(df_all)
    df_all = build_human_explanations(df_all)
    df_all = add_normal_band(df_all)

    # ✅ (추가) 전월대비 계산
    df_all = add_mom_change(df_all)
    # ✅ (추가) 직전 3/12개월 유효값 flag
    df_all = add_lookback_valid_flags(df_all)

    wide_df = build_wide_cost_data(df_all)
    cost_data_updated = wide_df.to_dict(orient="records")

    history_map = build_history_map(df_all)

    df_month = df_all[df_all["year_month"] == target_ym].copy()
    if df_month.empty:
        raise ValueError(f"파이프라인 이후에도 {target_ym} 데이터가 없습니다.")

    def _status_from_row(row):
        issue_type = row.get("issue_type")
        if issue_type == "결측 의심":
            return "issue"
        if issue_type == "정상":
            return "ok"
        if issue_type == "이상치 의심":
            return "check"
        return "check"

    df_month["status"] = df_month.apply(_status_from_row, axis=1)
    df_month["is_issue"] = df_month["status"] != "ok"

    total_rows = int(len(df_month))
    issue_rows = int(df_month["is_issue"].sum())
    missing_rows = int((df_month["issue_type"] == "결측 의심").sum())
    anomaly_rows = int((df_month["issue_type"] == "이상치 의심").sum())
    total_amount = float(df_month["amount"].sum(skipna=True))

    summary = {
        "year_month": target_ym,
        "total_rows": total_rows,
        "issue_rows": issue_rows,
        "missing_rows": missing_rows,
        "anomaly_rows": anomaly_rows,
        "total_amount": total_amount,
        "issue_ratio": float(issue_rows / total_rows) if total_rows else 0.0,
    }

    center_group = (
        df_month.groupby(["cost_center", "cc_name"], dropna=False)
        .agg(
            total_rows=("is_issue", "count"),
            issue_rows=("is_issue", "sum"),
            missing_rows=("issue_type", lambda s: (s == "결측 의심").sum()),
            anomaly_rows=("issue_type", lambda s: (s == "이상치 의심").sum()),
            total_amount=("amount", "sum"),
        )
        .reset_index()
    )

    center_group["issue_ratio"] = center_group["issue_rows"] / center_group["total_rows"].replace(0, np.nan)
    center_group = center_group.sort_values(["issue_rows", "total_amount"], ascending=[False, False])

    centers: List[Dict[str, Any]] = []
    for _, row in center_group.iterrows():
        centers.append(
            {
                "cost_center": str(row["cost_center"]),
                "cc_name": str(row["cc_name"]),
                "total_rows": int(row["total_rows"]),
                "issue_rows": int(row["issue_rows"]),
                "missing_rows": int(row["missing_rows"]),
                "anomaly_rows": int(row["anomaly_rows"]),
                "total_amount": float(row["total_amount"]),
                "issue_ratio": float(row["issue_ratio"]) if pd.notna(row["issue_ratio"]) else 0.0,
            }
        )

    issue_df = df_month[df_month["is_issue"]].copy()
    order_map = {"issue": 0, "check": 1, "ok": 2}
    issue_df["__order"] = issue_df["status"].map(order_map).fillna(1)
    issue_df = issue_df.sort_values(["__order", "severity_rank", "amount"], ascending=[True, False, False])

    issues: List[Dict[str, Any]] = []
    for _, row in issue_df.iterrows():
        row_key = f"{row.get('cost_center')}|{row.get('account_code')}"

        nu = row.get("normal_upper")
        nl = row.get("normal_lower")
        pattern_upper = float(nu) if (nu is not None and pd.notna(nu)) else None
        pattern_lower = float(nl) if (nl is not None and pd.notna(nl)) else None
        pattern_mean = (
            (pattern_upper + pattern_lower) / 2.0
            if (pattern_upper is not None and pattern_lower is not None)
            else None
        )

        amt_val = row.get("amount")
        is_missing_like = False
        try:
            if pd.isna(amt_val) or float(amt_val) == 0.0:
                is_missing_like = True
        except Exception:
            pass

        if is_missing_like:
            display_issue_type = "누락"
        elif str(row.get("issue_type")) == "이상치 의심":
            display_issue_type = "이상"
        else:
            display_issue_type = str(row.get("issue_type"))

        reason_kor = str(row.get("reason_kor") or "")
        reason_tags = row.get("reason_tags", [])

        mom_pct = row.get("mom_change_pct")
        lb3 = row.get("lookback3_has_value")
        lb12 = row.get("lookback12_has_value")

        reason_summary = _summarize_reason(
        reason_kor, reason_tags, display_issue_type,
        mom_pct, lb3, lb12,
        zscore_12=row.get("zscore_12"),
        dev_3m=row.get("dev_3m"),
        iso_score=row.get("iso_score"),
        lof_score=row.get("lof_score"),
        corr_score=row.get("corr_score") or row.get("corr_anom_score"),
    )

        issues.append(
            {
                "row_key": row_key,
                "year_month": str(row.get("year_month")),
                "year": int(row.get("year")),
                "month": int(row.get("month")),
                "cost_center": str(row.get("cost_center")),
                "cc_name": str(row.get("cc_name")),
                "account_code": str(row.get("account_code")),
                "account_name": str(row.get("account_name")),
                "cost_nature": str(row.get("cost_nature")),
                "amount": float(row.get("amount")) if pd.notna(row.get("amount")) else None,

                # ✅ (추가) 전월 값/전월대비%
                "prev_amount": float(row.get("prev_amount")) if pd.notna(row.get("prev_amount")) else None,
                "mom_change_pct": float(mom_pct) if (mom_pct is not None and pd.notna(mom_pct)) else None,

                # ✅ (추가) 직전 3/12개월 유효값 flag(원하면 프론트에도 쓸 수 있음)
                "lookback3_has_value": bool(lb3) if pd.notna(lb3) else None,
                "lookback12_has_value": bool(lb12) if pd.notna(lb12) else None,

                "issue_type": str(row.get("issue_type")),
                "severity_rank": int(row.get("severity_rank", 1)),
                "status": row.get("status"),
                "reason_kor": reason_kor,
                "reason_summary": reason_summary,
                "reason_tags": reason_tags,
                "zscore_12": float(row.get("zscore_12")) if pd.notna(row.get("zscore_12")) else None,
                "dev_3m": float(row.get("dev_3m")) if pd.notna(row.get("dev_3m")) else None,
                "iso_score": float(row.get("iso_score")) if pd.notna(row.get("iso_score")) else None,
                "lof_score": float(row.get("lof_score")) if pd.notna(row.get("lof_score")) else None,
                "anomaly_flag": bool(row.get("anomaly_flag", False)),
                "patternMean": pattern_mean,
                "patternUpper": pattern_upper,
                "patternLower": pattern_lower,
                "display_issue_type": display_issue_type,
            }
        )

    return {
        "summary": summary,
        "centers": centers,
        "issues": issues,
        "history": history_map,
        "costData": cost_data_updated,
    }


@app.route("/api/cost-center/analyze", methods=["POST"])
def analyze_cost_center():
    if "file" not in request.files:
        return jsonify({"error": "file 필드가 없습니다."}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "업로드된 파일명이 비어 있습니다."}), 400

    try:
        upload_df = parse_single_month_excel(io.BytesIO(f.read()))
        result = run_monthly_anomaly_pipeline(upload_df)
        return jsonify(result)
    except Exception as e:
        print("[/api/cost-center/analyze] error:", e)
        return jsonify({"error": str(e)}), 500


def run_default_cost_center_anomaly(use_cache: bool = True) -> Dict[str, Any]:
    cache_path = get_cache_path("default_anomaly_result.pkl")

    if use_cache and os.path.exists(cache_path):
        try:
            with open(cache_path, "rb") as f:
                result = pickle.load(f)
            print("[run_default_cost_center_anomaly] loaded from cache:", cache_path)
            return result
        except Exception as e:
            print("[run_default_cost_center_anomaly] cache load error, 재계산:", e)

    df = load_all_monthly_cost_long()
    df = detect_potential_missing(df, lookback_months=3)
    df = build_features(df)
    df = compute_corr_pairs(df)
    df = run_ensemble_outlier(df)
    df = build_human_explanations(df)
    df = add_normal_band(df)

    # ✅ (추가) 전월대비 계산
    df = add_mom_change(df)
    # ✅ (추가) 직전 3/12개월 유효값 flag
    df = add_lookback_valid_flags(df)

    df["year_month"] = df["year_month"].astype(str)
    unique_ym = sorted(df["year_month"].unique())
    if not unique_ym:
        raise ValueError("year_month 값이 없습니다.")
    target_ym = unique_ym[-1]

    history_map = build_history_map(df)
    df_month = df[df["year_month"] == target_ym].copy()
    if df_month.empty:
        raise ValueError(f"{target_ym} 월 데이터가 없습니다.")

    def _status_from_row(row):
        if row.get("issue_type") == "정상":
            return "ok"
        if row.get("issue_type") == "결측 의심" or row.get("severity_rank", 1) >= 4:
            return "issue"
        return "check"

    df_month["status"] = df_month.apply(_status_from_row, axis=1)
    df_month["is_issue"] = df_month["status"] != "ok"

    total_rows = int(len(df_month))
    issue_rows = int(df_month["is_issue"].sum())
    missing_rows = int((df_month["issue_type"] == "결측 의심").sum())
    anomaly_rows = int((df_month["issue_type"] == "이상치 의심").sum())
    total_amount = float(df_month["amount"].sum(skipna=True))

    summary = {
        "year_month": target_ym,
        "total_rows": total_rows,
        "issue_rows": issue_rows,
        "missing_rows": missing_rows,
        "anomaly_rows": anomaly_rows,
        "total_amount": total_amount,
        "issue_ratio": float(issue_rows / total_rows) if total_rows else 0.0,
    }

    center_group = (
        df_month.groupby(["cost_center", "cc_name"], dropna=False)
        .agg(
            total_rows=("is_issue", "count"),
            issue_rows=("is_issue", "sum"),
            missing_rows=("issue_type", lambda s: (s == "결측 의심").sum()),
            anomaly_rows=("issue_type", lambda s: (s == "이상치 의심").sum()),
            total_amount=("amount", "sum"),
        )
        .reset_index()
    )
    center_group["issue_ratio"] = center_group["issue_rows"] / center_group["total_rows"].replace(0, np.nan)
    center_group = center_group.sort_values(["issue_rows", "total_amount"], ascending=[False, False])

    centers: List[Dict[str, Any]] = []
    for _, row in center_group.iterrows():
        centers.append(
            {
                "cost_center": str(row["cost_center"]),
                "cc_name": str(row["cc_name"]),
                "total_rows": int(row["total_rows"]),
                "issue_rows": int(row["issue_rows"]),
                "missing_rows": int(row["missing_rows"]),
                "anomaly_rows": int(row["anomaly_rows"]),
                "total_amount": float(row["total_amount"]),
                "issue_ratio": float(row["issue_ratio"]) if pd.notna(row["issue_ratio"]) else 0.0,
            }
        )

    issue_df = df_month[df_month["is_issue"]].copy()
    order_map = {"issue": 0, "check": 1, "ok": 2}
    issue_df["__order"] = issue_df["status"].map(order_map).fillna(1)
    issue_df = issue_df.sort_values(["__order", "severity_rank", "amount"], ascending=[True, False, False])

    issues: List[Dict[str, Any]] = []
    for _, row in issue_df.iterrows():
        row_key = f"{row.get('cost_center')}|{row.get('account_code')}"

        amt_val = row.get("amount")
        is_missing_like = False
        try:
            if pd.isna(amt_val) or float(amt_val) == 0.0:
                is_missing_like = True
        except Exception:
            pass

        if is_missing_like:
            display_issue_type = "누락"
        elif str(row.get("issue_type")) == "이상치 의심":
            display_issue_type = "이상"
        else:
            display_issue_type = str(row.get("issue_type"))

        reason_kor = str(row.get("reason_kor") or "")
        reason_tags = row.get("reason_tags", [])

        mom_pct = row.get("mom_change_pct")
        lb3 = row.get("lookback3_has_value")
        lb12 = row.get("lookback12_has_value")

        reason_summary = _summarize_reason(reason_kor, reason_tags, display_issue_type, mom_pct, lb3, lb12)

        issues.append(
            {
                "row_key": row_key,
                "year_month": str(row.get("year_month")),
                "year": int(row.get("year")),
                "month": int(row.get("month")),
                "cost_center": str(row.get("cost_center")),
                "cc_name": str(row.get("cc_name")),
                "account_code": str(row.get("account_code")),
                "account_name": str(row.get("account_name")),
                "cost_nature": str(row.get("cost_nature")),
                "amount": float(row.get("amount")) if pd.notna(row.get("amount")) else None,

                # ✅ (추가)
                "prev_amount": float(row.get("prev_amount")) if pd.notna(row.get("prev_amount")) else None,
                "mom_change_pct": float(mom_pct) if (mom_pct is not None and pd.notna(mom_pct)) else None,

                # ✅ (추가)
                "lookback3_has_value": bool(lb3) if pd.notna(lb3) else None,
                "lookback12_has_value": bool(lb12) if pd.notna(lb12) else None,

                "issue_type": str(row.get("issue_type")),
                "severity_rank": int(row.get("severity_rank", 1)),
                "status": row.get("status"),
                "reason_kor": reason_kor,
                "reason_summary": reason_summary,
                "reason_tags": reason_tags,
                "zscore_12": float(row.get("zscore_12")) if pd.notna(row.get("zscore_12")) else None,
                "dev_3m": float(row.get("dev_3m")) if pd.notna(row.get("dev_3m")) else None,
                "iso_score": float(row.get("iso_score")) if pd.notna(row.get("iso_score")) else None,
                "lof_score": float(row.get("lof_score")) if pd.notna(row.get("lof_score")) else None,
                "anomaly_flag": bool(row.get("anomaly_flag", False)),
            }
        )

    result = {"summary": summary, "centers": centers, "issues": issues, "history": history_map}

    try:
        with open(cache_path, "wb") as f:
            pickle.dump(result, f)
        print("[run_default_cost_center_anomaly] saved cache:", cache_path)
    except Exception as e:
        print("[run_default_cost_center_anomaly] cache save error:", e)

    return result


@app.route("/api/cost-center/analyze-default", methods=["GET"])
def analyze_cost_center_default():
    try:
        result = run_default_cost_center_anomaly(use_cache=True)
        return jsonify(result)
    except Exception as e:
        print("[/api/cost-center/analyze-default] error:", e)
        return jsonify({"error": str(e)}), 500


# =====================================================
# Topic3: P&L Back data 업로드 + 통합 리포트 생성
# =====================================================
@app.route("/api/pl-report/back-data", methods=["POST"])
def upload_pl_back_data():
    if "file" not in request.files:
        return jsonify({"error": "file 필드가 없습니다."}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "업로드된 파일명이 비어 있습니다."}), 400

    force = request.args.get("force") == "1"

    try:
        REPORT_DATA_DIR.mkdir(parents=True, exist_ok=True)

        original_name = f.filename
        ym = _parse_year_month_from_upload_filename(original_name)
        original_path = REPORT_DATA_DIR / original_name

        if ym:
            year, month = ym
            yy2 = year % 100
            report_stem = f"{yy2:02d}년_{month:02d}월_결산보고서_통합"
        else:
            stem = Path(original_name).stem
            if "결산보고서_back_data" in stem:
                report_stem = stem.replace("결산보고서_back_data", "결산보고서_통합")
            elif "back_data" in stem:
                report_stem = stem.replace("back_data", "결산보고서_통합")
            else:
                report_stem = stem + "_결산보고서_통합"

        report_path = REPORT_DATA_DIR / f"{report_stem}.xlsx"

        if ym:
            year, month = ym
            existing = _find_existing_pl_files_for_period(year, month)
            has_existing = bool(existing["reports"] or existing["backs"] or report_path.exists() or original_path.exists())

            if has_existing and not force:
                return jsonify(
                    {
                        "status": "ok",
                        "need_confirm": True,
                        "message": "이미 해당 연도와 월에 해당하는 데이터가 있습니다. 다시 저장할까요?",
                        "year": year,
                        "month": month,
                    }
                )

            if force:
                for p in existing["reports"] + existing["backs"]:
                    try:
                        p.unlink()
                    except Exception:
                        pass
                if original_path.exists():
                    try:
                        original_path.unlink()
                    except Exception:
                        pass
                if report_path.exists():
                    try:
                        report_path.unlink()
                    except Exception:
                        pass

        else:
            if report_path.exists() and not force:
                return jsonify(
                    {"status": "ok", "need_confirm": True, "message": "이미 해당 연도와 월에 해당하는 데이터가 있습니다. 다시 저장할까요?"}
                )
            if force:
                if original_path.exists():
                    try:
                        original_path.unlink()
                    except Exception:
                        pass
                if report_path.exists():
                    try:
                        report_path.unlink()
                    except Exception:
                        pass

        f.save(str(original_path))

        try:
            df = generate_pl_report_df(back_data_file=str(original_path))
        except TypeError:
            df = generate_pl_report_df()

        df.to_excel(report_path, sheet_name="보고서", index=False)

        return jsonify(
            {"status": "ok", "overwritten": bool(force), "back_data_file": str(original_path), "report_file": str(report_path)}
        )

    except Exception as e:
        print("[ERROR] /api/pl-report/back-data:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/pl-report/periods", methods=["GET"])
def get_pl_report_periods():
    try:
        REPORT_DATA_DIR.mkdir(parents=True, exist_ok=True)

        periods: Dict[Tuple[int, int], Dict[str, Any]] = {}

        for path in REPORT_DATA_DIR.glob("*결산보고서_통합*.xlsx"):
            parsed = _parse_year_month_from_report_filename(path)
            if not parsed:
                continue
            year, month = parsed
            key = (year, month)
            if key not in periods:
                yy2 = year % 100
                label = f"{yy2:02d}년 {month:02d}월"
                periods[key] = {"year": year, "month": month, "year2": yy2, "month2": month, "label": label}

        sorted_periods = [periods[k] for k in sorted(periods.keys(), key=lambda x: (x[0], x[1]))]
        return jsonify({"periods": sorted_periods})

    except Exception as e:
        print("[ERROR] /api/pl-report/periods:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/pl-cause/periods", methods=["GET"])
def get_pl_cause_periods():
    try:
        periods = list_available_periods()
        return jsonify({"periods": periods})
    except Exception as e:
        print("[ERROR] /api/pl-cause/periods:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/pl-cause", methods=["GET"])
def get_pl_cause():
    try:
        year = request.args.get("year", type=int)
        month = request.args.get("month", type=int)

        if not year or not month:
            return jsonify({"error": "year, month 쿼리 파라미터가 필요합니다."}), 400

        ym = year * 100 + month
        result = analyze_pl_cause(ym)
        return jsonify(result)

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        print("[ERROR] /api/pl-cause:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/pl-report", methods=["GET"])
def get_pl_report():
    try:
        REPORT_DATA_DIR.mkdir(parents=True, exist_ok=True)

        year_param = request.args.get("year")
        month_param = request.args.get("month")

        candidates: List[Path] = []

        if year_param and month_param:
            try:
                year = int(year_param)
                month = int(month_param)
            except ValueError:
                return jsonify({"error": "year, month 파라미터는 정수여야 합니다."}), 400

            if not (1 <= month <= 12):
                return jsonify({"error": "month 파라미터는 1~12 사이여야 합니다."}), 400

            yy2 = year % 100
            pattern = f"{yy2:02d}년_{month:02d}월*결산보고서_통합*.xlsx"
            candidates = sorted(REPORT_DATA_DIR.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)

            if not candidates:
                return jsonify({"error": f"요청한 연도/월({year}-{month:02d})의 PL Report 파일을 찾을 수 없습니다."}), 404
        else:
            candidates = sorted(REPORT_DATA_DIR.glob("*결산보고서_통합*.xlsx"), key=lambda p: p.stat().st_mtime, reverse=True)

        if candidates:
            latest_path = candidates[0]
            df = pd.read_excel(latest_path, sheet_name="보고서")
            rows = df.to_dict(orient="records")
            return jsonify({"rows": rows, "filename": latest_path.name})

        cache_path = get_cache_path("pl_report_df.pkl")
        if os.path.exists(cache_path):
            try:
                df = pd.read_pickle(cache_path)
                rows = df.to_dict(orient="records")
                return jsonify({"rows": rows, "filename": "pl_report_df.pkl"})
            except Exception as e:
                print("[/api/pl-report] cache load error, 재계산:", e)

        try:
            df = generate_pl_report_df(back_data_file=str(BACKDATA_EXCEL_PATH))
        except TypeError:
            df = generate_pl_report_df()

        try:
            df.to_pickle(cache_path)
        except Exception:
            pass

        rows = df.to_dict(orient="records")
        return jsonify({"rows": rows, "filename": "generated_from_backdata"})

    except Exception as e:
        print("[ERROR] /api/pl-report:", e)
        return jsonify({"error": str(e)}), 500


# =====================================================
# Topic4: 최신 결산 반영 + 재학습 (백그라운드)
# =====================================================
_topic4_state = {
    "running": False,
    "step": "idle",
    "started_at": None,
    "finished_at": None,
    "ok": None,
    "error": None,
    "detail": None,
}
_topic4_lock = threading.Lock()


def _topic4_run_sync_and_retrain():
    global forecast_payload

    with _topic4_lock:
        _topic4_state.update(
            {
                "running": True,
                "step": "update_excel",
                "started_at": datetime.now().isoformat(timespec="seconds"),
                "finished_at": None,
                "ok": None,
                "error": None,
                "detail": None,
            }
        )

    try:
        update_script = str(BASE_DIR / "update_forecast_data.py")
        proc = subprocess.run(
            [sys.executable, update_script],
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
        )

        if proc.returncode != 0:
            raise RuntimeError(
                "[주제4] update_forecast_data.py 실패\n"
                f"STDOUT:\n{(proc.stdout or '')[-2000:]}\n"
                f"STDERR:\n{(proc.stderr or '')[-2000:]}"
            )

        with _topic4_lock:
            _topic4_state["detail"] = {"update_stdout": (proc.stdout or "")[-3000:]}

        with _topic4_lock:
            _topic4_state["step"] = "train_prophet"

        trained = train_prophet_models(test_horizon=6)
        forecast_payload = trained if trained is not None else load_or_train()

        with _topic4_lock:
            _topic4_state.update(
                {
                    "running": False,
                    "step": "done",
                    "finished_at": datetime.now().isoformat(timespec="seconds"),
                    "ok": True,
                }
            )

    except Exception as e:
        with _topic4_lock:
            _topic4_state.update(
                {
                    "running": False,
                    "step": "failed",
                    "finished_at": datetime.now().isoformat(timespec="seconds"),
                    "ok": False,
                    "error": str(e),
                    "detail": {"trace": traceback.format_exc()[-5000:]},
                }
            )


def _topic4_start_background_job():
    with _topic4_lock:
        if _topic4_state["running"]:
            return {"ok": True, "already_running": True, **_topic4_state}

        t = threading.Thread(target=_topic4_run_sync_and_retrain, daemon=True)
        t.start()
        return {"ok": True, "started": True, **_topic4_state}


@app.route("/api/topic4/sync-and-retrain", methods=["POST"])
def topic4_sync_and_retrain():
    payload = _topic4_start_background_job()
    return jsonify(payload), 200


@app.route("/api/topic4/sync-and-retrain/status", methods=["GET"])
def topic4_sync_and_retrain_status():
    with _topic4_lock:
        return jsonify({"ok": True, **_topic4_state}), 200


@app.route("/api/closing/sync-and-retrain", methods=["POST"])
def closing_sync_and_retrain_alias():
    payload = _topic4_start_background_job()
    return jsonify(payload), 200


@app.route("/api/closing/sync-and-retrain/status", methods=["GET"])
def closing_sync_and_retrain_status_alias():
    with _topic4_lock:
        return jsonify({"ok": True, **_topic4_state}), 200


@app.route("/api/closing/forecast", methods=["POST"])
def api_closing_forecast():
    try:
        body = request.get_json(silent=True) or {}
        months = int(body.get("months", 12))
        raw_scenario = body.get("scenario", {}) or {}

        preds = forecast_next_n(
            forecast_payload,
            n=months,
            scenario=raw_scenario if raw_scenario else None,
        )

        return jsonify({"ok": True, "months": months, "predictions": preds, "scenario": raw_scenario}), 200

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


def test_db_connection():
    if not USE_DB_AUTH:
        print("[DB TEST] 데모 모드(USE_DB_AUTH=False) → DB 연결 테스트 스킵")
        return

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            row = cur.fetchone()
            print("[DB TEST] 연결 성공:", row)
    except Exception as e:
        print("[DB TEST] 연결 실패:", e)
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    print("[INFO] Flask 서버 시작")
    test_db_connection()
    app.run(host="0.0.0.0", port=5000, debug=True)
