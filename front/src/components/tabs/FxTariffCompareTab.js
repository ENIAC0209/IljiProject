// src/components/tabs/FxTariffCompareTab.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

// White/Blue theme (요구사항: 검은색 금지)
const BRAND_BLUE = "#2563eb";
const BRAND_BLUE_SOFT = "#eff6ff";
const TEXT_DARK = "#0f172a";

const PERIOD_OPTIONS = [
  { value: 3, label: "3개월" },
  { value: 6, label: "6개월" },
  { value: 12, label: "12개월 (1년)" },
  { value: 36, label: "36개월 (3년)" },
  { value: 60, label: "60개월 (5년)" },
];

const fmt = (v) => {
  if (v === null || v === undefined) return "-";
  const n = Number(v);
  if (Number.isFinite(n)) return Math.round(n).toLocaleString("ko-KR");
  return String(v);
};
const fmtKRW = (v) => `${fmt(v)} 원`;

function FxTariffCompareTab({ cardStyle }) {
  const baseCardStyle = cardStyle || {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    border: "1px solid #e5e7eb",
    boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
    padding: 20,
  };

  // ------------------------------
  // Inputs
  // ------------------------------
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const [options, setOptions] = useState({ cars: [], plants: [], groups: [], markets: [], months: [] });

  const [car, setCar] = useState("");
  const [group, setGroup] = useState("");
  const [plant, setPlant] = useState("");
  const [market, setMarket] = useState(""); // "", "내수", "직수출"

  // ✅ 부품검색(q) 제거 → 컬럼검색(searchValue)로 통합
  const [searchColumn, setSearchColumn] = useState("");
  const [searchValue, setSearchValue] = useState("");

  const [tariffPct, setTariffPct] = useState("0");
  const [fxMode, setFxMode] = useState("pct"); // pct|auto
  const [fxChangePct, setFxChangePct] = useState("0");

  // auto FX forecast
  const [forecastMonths, setForecastMonths] = useState(12);
  const [fxForecast, setFxForecast] = useState(null); // { rates: {ym: rate} }
  const [fxForecastLoading, setFxForecastLoading] = useState(false);
  const [fxForecastError, setFxForecastError] = useState(null);

  // analyze
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // ------------------------------
  // Helpers
  // ------------------------------
  const normalizeOptArray = (v) => {
    if (!v) return [];
    const arr = Array.isArray(v) ? v : [v];
    return Array.from(
      new Set(
        arr
          .map((x) => (x === null || x === undefined ? "" : String(x).trim()))
          .filter((x) => x && x.toLowerCase() !== "nan" && x !== "undefined")
      )
    );
  };

  const buildFormData = (extra = {}) => {
    const fd = new FormData();
    fd.append("file", file);

    fd.append("car", car || "");
    fd.append("group", group || "");
    fd.append("plant", plant || "");
    fd.append("market", market || "");

    // ✅ 백엔드 호환: 컬럼 미선택이면 q로도 같이 보내서 “전체검색”처럼 동작
    const sv = (searchValue || "").trim();
    const sc = (searchColumn || "").trim();
    fd.append("search_column", sc);
    fd.append("search_value", sv);
    fd.append("q", sc ? "" : sv);

    fd.append("tariff_pct", String(tariffPct || "0"));

    // FX mode
    fd.append("fx_mode", fxMode);
    if (fxMode === "pct") {
      fd.append("fx_change_pct", String(fxChangePct || "0"));
    } else {
      fd.append("fx_change_pct", "0");
    }

    Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    return fd;
  };

  const fetchOptions = async (fileObj) => {
    const fd = new FormData();
    fd.append("file", fileObj);
    const res = await fetch("/api/external/fx-tariff/v2/options", { method: "POST", body: fd });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return data.options || {};
  };

  const fetchForecast = async () => {
    try {
      setFxForecastLoading(true);
      setFxForecastError(null);
      setFxForecast(null);

      const months = Number(forecastMonths) || 12;
      const qs = new URLSearchParams();
      qs.set("months", String(months));

      const res = await fetch(`/api/external/fx/forecast?${qs.toString()}`);
      const text = await res.text();

      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(text ? String(text).slice(0, 200) : `HTTP ${res.status}`);
      }

      if (!res.ok || data.ok === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setFxForecast(data);
    } catch (e) {
      setFxForecastError(e.message || String(e));
    } finally {
      setFxForecastLoading(false);
    }
  };

  const runAnalyze = async () => {
    try {
      if (!file) throw new Error("판매계획 엑셀 파일을 업로드해주세요.");

      setLoading(true);
      setError(null);
      setResult(null);

      const fd = buildFormData();
      const res = await fetch("/api/external/fx-tariff/v2/analyze", { method: "POST", body: fd });
      const text = await res.text();

      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok || data.ok === false) throw new Error(data?.error || `HTTP ${res.status}`);

      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // On file change: get options
  // ------------------------------
  useEffect(() => {
    if (!file) return;

    (async () => {
      try {
        const opt = await fetchOptions(file);

        const next = {
          cars: normalizeOptArray(opt.cars),
          plants: normalizeOptArray(opt.plants),
          groups: normalizeOptArray(opt.groups),
          markets: normalizeOptArray(opt.markets),
          months: normalizeOptArray(opt.months),
        };
        setOptions(next);

        // 선택값이 옵션에서 사라지는 경우 초기화
        if (car && next.cars && !next.cars.includes(car)) setCar("");
        if (plant && next.plants && !next.plants.includes(plant)) setPlant("");
        if (group && next.groups && !next.groups.includes(group)) setGroup("");
        if (market && next.markets && !next.markets.includes(market)) setMarket("");
      } catch (e) {
        setError(e.message || String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // ------------------------------
  // Derived
  // ------------------------------
  const summary = result?.summary;
  const series = result?.monthly_series || [];

  const kpis = useMemo(() => {
    const s = summary || {};
    const tot = s.total || {};
    const dom = s.domestic || {};
    const exp = s.export || {};
    return [
      ["전체 Base", fmtKRW(tot.base_krw)],
      ["전체 Scenario", fmtKRW(tot.scenario_krw)],
      ["전체 Δ", fmtKRW(tot.delta_krw)],
      ["내수 Base", fmtKRW(dom.base_krw)],
      ["내수 Scenario", fmtKRW(dom.scenario_krw)],
      ["직수출 Base", fmtKRW(exp.base_krw)],
      ["직수출 Scenario", fmtKRW(exp.scenario_krw)],
      ["직수출 Δ", fmtKRW(exp.delta_krw)],
      ["관세비용(직수출 포함)", fmtKRW(tot.tariff_cost_krw)],
      ["Net(전체)", fmtKRW(tot.net_krw)],
    ];
  }, [summary]);

  const fxForecastChart = useMemo(() => {
    const rates = fxForecast?.rates || {};
    return Object.keys(rates)
      .sort()
      .map((ym) => ({ ym, rate: rates[ym] }));
  }, [fxForecast]);

  const exportDeltaTop = useMemo(() => {
    const rows = result?.rows || [];
    return rows
      .filter((r) => r.market === "직수출")
      .slice(0, 15)
      .map((r) => ({
        name: (r.code || r.item_key || r.item_name || "").slice(0, 18),
        delta: r.delta_krw,
      }));
  }, [result]);

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div style={{ ...baseCardStyle }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: TEXT_DARK }}>
            환율·관세 영향 분석 (내수 vs 직수출)
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            엑셀 기반으로 부품별 내수/직수출을 분리하여 비교하고, 직수출에만 환율/관세 시나리오를 적용합니다.
          </div>
        </div>

        <button
          onClick={runAnalyze}
          disabled={loading}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: `1px solid ${BRAND_BLUE}`,
            background: BRAND_BLUE,
            color: "white",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
            minWidth: 160,
          }}
        >
          {loading ? "분석 중..." : "분석 실행"}
        </button>
      </div>

      {/* Inputs */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
        {/* Upload + Filters */}
        <div style={{ ...baseCardStyle, padding: 16, borderColor: "#dbeafe", background: BRAND_BLUE_SOFT }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: TEXT_DARK, marginBottom: 10 }}>데이터 업로드 / 필터</div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{
                height: 56,
                flex: 1,
                minWidth: 260,
                borderRadius: 12,
                border: "1px dashed #93c5fd",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                cursor: "pointer",
                padding: "0 12px",
              }}
              title="클릭해서 엑셀 업로드"
            >
              <span style={{ fontSize: 22, fontWeight: 900, color: BRAND_BLUE }}>⤒</span>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: TEXT_DARK }}>엑셀 업로드</span>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {file ? file.name : "판매계획(통합 시트) .xlsx"}
                </span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>차종</div>
              <select
                value={car}
                onChange={(e) => setCar(e.target.value)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #bfdbfe",
                  background: "#fff",
                  fontWeight: 800,
                  outline: "none",
                }}
              >
                <option value="">전체</option>
                {options.cars.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>플랜트</div>
              <select
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "10px 10px",
                  fontSize: 13,
                  background: "#fff",
                  fontWeight: 800,
                  outline: "none",
                }}
              >
                <option value="">전체</option>
                {options.plants.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>자재그룹</div>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #bfdbfe",
                  background: "#fff",
                  fontWeight: 800,
                  outline: "none",
                }}
              >
                <option value="">전체</option>
                {options.groups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>시장</div>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #bfdbfe",
                  background: "#fff",
                  fontWeight: 800,
                  outline: "none",
                }}
              >
                <option value="">전체</option>
                <option value="내수">내수</option>
                <option value="직수출">직수출</option>
              </select>
            </div>

            {/* ✅ 부품검색 제거 → 컬럼 검색이 한 줄 전체 폭 */}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>컬럼 검색 (선택)</div>
              <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.4fr", gap: 8, marginTop: 6 }}>
                <select
                  value={searchColumn}
                  onChange={(e) => setSearchColumn(e.target.value)}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "10px 10px",
                    fontSize: 13,
                    background: "#fff",
                    fontWeight: 800,
                    outline: "none",
                  }}
                >
                  <option value="">(전체 컬럼)</option>
                  {/* ✅ 백엔드 표준 컬럼명으로 전송 */}
                  <option value="code">자재코드</option>
                  <option value="name">자재내역</option>
                  <option value="plant">플랜트</option>
                  <option value="car">차종</option>
                  <option value="group">자재그룹</option>
                  <option value="market">시장</option>
                  <option value="ym">월(YYYY-MM)</option>
                  <option value="currency">통화</option>
                </select>

                <input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="예: 90A / 울산 / LK..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #bfdbfe",
                    background: "#fff",
                    fontWeight: 800,
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                컬럼을 선택하면 해당 컬럼에서만 검색됩니다. (전체 컬럼 선택 시 전체 검색으로 동작)
              </div>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 10, color: "#dc2626", fontWeight: 800, fontSize: 12 }}>
              {String(error)}
            </div>
          )}
        </div>

        {/* Scenario (FX/Tariff) */}
        <div style={{ ...baseCardStyle, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: TEXT_DARK, marginBottom: 10 }}>
            시나리오 입력 (직수출에만 적용)
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>관세(%)</div>
              <input
                value={tariffPct}
                onChange={(e) => setTariffPct(e.target.value)}
                placeholder="예: 3"
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontWeight: 800,
                  outline: "none",
                }}
              />
              <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>
                내수는 관세/환율 영향 0, 직수출만 적용됩니다.
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>환율 입력 방식</div>
              <select
                value={fxMode}
                onChange={(e) => setFxMode(e.target.value)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontWeight: 800,
                  outline: "none",
                }}
              >
                <option value="pct">수동(%)로 민감도</option>
                <option value="auto">자동(최근 패턴 기반 예측)</option>
              </select>
            </div>
          </div>

          {fxMode === "pct" ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>환율 변화(%)</div>
              <input
                value={fxChangePct}
                onChange={(e) => setFxChangePct(e.target.value)}
                placeholder="예: 5 (=> +5%)"
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontWeight: 800,
                  outline: "none",
                }}
              />
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>
                  자동 환율 예측
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={forecastMonths}
                    onChange={(e) => setForecastMonths(parseInt(e.target.value, 10))}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      fontWeight: 800,
                      outline: "none",
                      minWidth: 160,
                    }}
                  >
                    {PERIOD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>

                  <button
                    onClick={fetchForecast}
                    disabled={fxForecastLoading}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #bfdbfe",
                      background: "#fff",
                      cursor: fxForecastLoading ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      color: TEXT_DARK,
                    }}
                  >
                    {fxForecastLoading ? "예측 중..." : "환율 예측 보기"}
                  </button>
                </div>
              </div>

              {fxForecastError && (
                <div style={{ marginTop: 8, color: "#dc2626", fontWeight: 800, fontSize: 12 }}>
                  {String(fxForecastError)}
                </div>
              )}

              {fxForecast && (
                <div style={{ marginTop: 10, height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart data={fxForecastChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="ym" />
                      <YAxis domain={["dataMin - 20", "dataMax + 20"]} tickFormatter={(v) => Math.round(v)} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="rate" name="예측 USD/KRW" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                자동 모드는 “분석 실행” 시 파일 월(YYYY-MM) 기준으로 직수출 환율을 월별로 예측하여 적용합니다.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div style={{ marginTop: 16 }}>
          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {kpis.map(([k, v]) => (
              <div key={k} style={{ ...baseCardStyle, padding: 14 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: TEXT_DARK, marginTop: 6 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Monthly Compare */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ ...baseCardStyle }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: TEXT_DARK, marginBottom: 10 }}>
                월별 매출(원화): 내수 vs 직수출 (Base)
              </div>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={series.map((s) => ({
                      ym: s.ym,
                      내수: s["내수_base"] ?? s.domestic_base ?? 0,
                      직수출: s["직수출_base"] ?? s.export_base ?? 0,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ym" />
                    <YAxis />
                    <Tooltip formatter={(v) => fmtKRW(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="내수" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="직수출" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ ...baseCardStyle }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: TEXT_DARK, marginBottom: 10 }}>
                월별 Net(원화): 내수 vs 직수출 (Scenario-관세)
              </div>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={series.map((s) => ({
                      ym: s.ym,
                      내수: s["내수_net"] ?? s.domestic_net ?? 0,
                      직수출: s["직수출_net"] ?? s.export_net ?? 0,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ym" />
                    <YAxis />
                    <Tooltip formatter={(v) => fmtKRW(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="내수" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="직수출" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Export top deltas */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ ...baseCardStyle }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: TEXT_DARK, marginBottom: 10 }}>
                직수출 영향 TOP (Δ, 절대값 기준)
              </div>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={exportDeltaTop}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip formatter={(v) => fmtKRW(v)} />
                    <Legend />
                    <Bar dataKey="delta" name="Δ(원화)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                * 내수는 Δ=0(영향 없음). 직수출의 영향도가 큰 품목을 우선 표시합니다.
              </div>
            </div>

            <div style={{ ...baseCardStyle }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: TEXT_DARK, marginBottom: 10 }}>
                직수출 Δ TOP - 차종/자재그룹
              </div>

              <div style={{ marginTop: 12, height: 240 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 6 }}>차종 Δ</div>
                <ResponsiveContainer>
                  <BarChart
                    data={(result.breakdown?.car_top_delta || result.breakdown?.export_car_top_delta || []).slice(0, 10)}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip formatter={(v) => fmtKRW(v)} />
                    <Legend />
                    <Bar dataKey="value" name="차종 Δ(원화)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginTop: 12, height: 240 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 6 }}>자재그룹 Δ</div>
                <ResponsiveContainer>
                  <BarChart
                    data={(result.breakdown?.group_top_delta || result.breakdown?.export_group_top_delta || []).slice(0, 10)}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip formatter={(v) => fmtKRW(v)} />
                    <Legend />
                    <Bar dataKey="value" name="자재그룹 Δ(원화)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ marginTop: 14, ...baseCardStyle }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: TEXT_DARK }}>
                상세 리스트 (상위 {Math.min((result.rows || []).length, 300)}건)
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                정렬: |Δ| 큰 순 / 필터: 차종·그룹·플랜트·시장·검색
              </div>
            </div>

            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["market", "code", "name", "car", "group", "plant", "base_krw", "scenario_krw", "delta_krw", "tariff_cost", "net_krw"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 8px",
                          borderBottom: "1px solid #e5e7eb",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result.rows || []).slice(0, 120).map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{r.market}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{r.code || "-"}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name || ""}>
                        {r.name || "-"}
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{r.car || "-"}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{r.group || "-"}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{r.plant || "-"}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{fmt(r.base_krw)}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{fmt(r.scenario_krw)}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{fmt(r.delta_krw)}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{fmt(r.tariff_cost)}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{fmt(r.net_krw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(result.rows || []).length > 120 && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
                화면 표시 성능을 위해 120건만 렌더링합니다. 서버는 최대 300건까지 반환합니다.
              </div>
            )}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div style={{ marginTop: 14, fontSize: 12, color: "#64748b" }}>
          엑셀 업로드 → (필요 시 필터/시나리오 입력) → “분석 실행”을 누르면 시각화가 표시됩니다.
        </div>
      )}
    </div>
  );
}

export default FxTariffCompareTab;
