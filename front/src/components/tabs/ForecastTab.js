// src/components/tabs/ForecastTab.js
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { BRAND_ORANGE, BRAND_GREEN, BRAND_DARK } from "../../config/plConfig";

// ===============================
// 시나리오 항목 (주요 비용 드라이버)
// ===============================
const DRIVER_OPTIONS = [
  { key: "원재료비", label: "원재료비" },
  { key: "부재료비(전체)", label: "부재료비(전체)" }, // -> 부재료비_전체
  { key: "급여(전체)", label: "급여(전체)" }, // -> 총인건비
  { key: "전력비", label: "전력비" },
  { key: "판관비(전체)", label: "판관비(전체)" }, // -> 판매비와일반관리비
];

// 예측 기간 옵션
const PERIOD_OPTIONS = [
  { value: 3, label: "3개월" },
  { value: 6, label: "6개월" },
  { value: 12, label: "12개월 (1년)" },
  { value: 36, label: "36개월 (3년)" },
  { value: 60, label: "60개월 (5년)" },
  { value: 120, label: "120개월 (10년)" },
];

// 숫자 포맷
const fmt = (v) =>
  typeof v === "number" ? Math.round(v).toLocaleString("ko-KR") : v ?? "-";

// 억 단위 축 포맷
const fmtHundredMillion = (v) => `${Math.round(v / 1e8)}억`;

// Impact 색상 팔레트
const IMPACT_COLORS = ["#fb7185", "#fb923c", "#22c55e", "#3b82f6", "#a855f7"];

// ✅ 이익 추세 Legend (순서 고정 + 가운데 정렬)
const renderTrendLegend = (props) => {
  const { payload } = props;
  if (!payload || !payload.length) return null;

  const order = ["매출총이익", "당기순이익", "영업이익"];
  const ordered = order
    .map((key) => payload.find((item) => item.dataKey === key))
    .filter(Boolean);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        marginTop: 4,
      }}
    >
      <ul
        style={{
          listStyle: "none",
          display: "flex",
          gap: 16,
          margin: 0,
          padding: 0,
          fontSize: 11,
        }}
      >
        {ordered.map((item) => (
          <li
            key={item.dataKey}
            style={{ display: "flex", alignItems: "center" }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "999px",
                backgroundColor: item.color,
                display: "inline-block",
                marginRight: 4,
              }}
            />
            <span>{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

function ForecastTab({ cardStyle }) {
  const baseCardStyle = cardStyle || {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    border: "1px solid #e5e7eb",
    boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
    padding: 20,
  };

  // ===============================
  // 상태
  // ===============================
  const [period, setPeriod] = useState(12);

  const [scenarioRows, setScenarioRows] = useState([
    { id: 1, driverKey: "원재료비", value: "0" },
    { id: 2, driverKey: "부재료비(전체)", value: "0" },
    { id: 3, driverKey: "급여(전체)", value: "0" },
    { id: 4, driverKey: "전력비", value: "0" },
    { id: 5, driverKey: "판관비(전체)", value: "0" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // ===============================
  // [주제4] 최신 결산 반영 + 재학습 상태(폴링)
  // ===============================
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const syncTimerRef = useRef(null);

  // 결과 영역 ref (PDF 캡쳐용)
  const resultRef = useRef(null);

  // ===============================
  // ✅ IMPORTANT: app.py 엔드포인트와 정확히 일치해야 함
  //   app.py:
  //     POST /api/topic4/sync-and-retrain
  //     GET  /api/topic4/sync-and-retrain/status
  // ===============================
  const SYNC_RETRAIN_ENDPOINT = "/api/topic4/sync-and-retrain";
  const SYNC_RETRAIN_STATUS_ENDPOINT = "/api/topic4/sync-and-retrain/status";

  // ===============================
  // API 헬퍼 (예측)
  // ===============================
  const callForecastApi = async (months, scenario) => {
    const res = await fetch("/api/closing/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ months, scenario }),
    });

    // 일부 에러 응답이 JSON이 아닐 수 있으니 안전 처리
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "예측 API 호출 중 오류가 발생했습니다.");
    }
    return data;
  };

  // ===============================
  // [주제4] 재학습 상태 조회(폴링)
  // ===============================
  const fetchSyncStatus = async () => {
    const res = await fetch(SYNC_RETRAIN_STATUS_ENDPOINT);

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { ok: false, error: "status 응답이 JSON이 아닙니다.", raw: text };
    }

    setSyncStatus(data);

    // 끝났으면 폴링 중지
    if (data && data.running === false && syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  };

  // ===============================
  // [주제4] 최신 결산 반영 + 재학습 시작
  // ===============================
  const handleSyncAndRetrain = async () => {
    try {
      setSyncLoading(true);
      setError(null);
      setSyncStatus(null);

      const res = await fetch(SYNC_RETRAIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { ok: false, error: "start 응답이 JSON이 아닙니다.", raw: text };
      }

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || `데이터 업데이트/재학습 시작 실패 (HTTP ${res.status})`);
      }

      // ✅ started / already_running 모두 ok: true로 내려오므로 폴링 시작
      await fetchSyncStatus();

      if (!syncTimerRef.current) {
        syncTimerRef.current = setInterval(fetchSyncStatus, 2000);
      }

      // 모델/데이터 바뀌면 기존 예측은 무효일 수 있으니 초기화
      setResult(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "데이터 업데이트/재학습 중 오류가 발생했습니다.");
    } finally {
      setSyncLoading(false);
    }
  };

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, []);

  // ===============================
  // 예측 실행
  // ===============================
  const handleRunForecast = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const months = period || 12;

      // 입력 시나리오:
      // 현재 프로젝트 기준: "200% 입력 = 2배" (즉 기준값 * 2)
      // -> 백엔드가 곱셈 해석을 한다는 전제 하에 rate = 2.0 전달
      const scenarioMap = {};
      const activeDrivers = [];

      scenarioRows.forEach((row) => {
        const rateNum = parseFloat(row.value);
        if (!isNaN(rateNum) && rateNum !== 0) {
          const totalRate = rateNum / 100.0; // 200% -> 2.0
          scenarioMap[row.driverKey] = totalRate;
          activeDrivers.push({
            key: row.driverKey,
            label: row.driverKey,
            rate: totalRate,
          });
        }
      });

      const promises = [
        callForecastApi(months, {}),
        callForecastApi(months, scenarioMap),
        ...activeDrivers.map((d) => callForecastApi(months, { [d.key]: d.rate })),
      ];

      const responses = await Promise.all(promises);
      const baseRes = responses[0];
      const fullRes = responses[1];
      const perDriverRes = responses.slice(2);

      const basePreds = baseRes.predictions || [];
      const scenarioPreds = fullRes.predictions || [];

      // Impact Ranking (마지막 달 기준)
      const baseLastOp =
        basePreds.length > 0 ? basePreds[basePreds.length - 1]["영업이익"] || 0 : 0;

      const driverImpacts = activeDrivers.map((drv, idx) => {
        const drvPreds = perDriverRes[idx]?.predictions || [];
        const drvLastOp =
          drvPreds.length > 0 ? drvPreds[drvPreds.length - 1]["영업이익"] || 0 : 0;

        const diff = drvLastOp - baseLastOp;
        const rate = baseLastOp ? (diff / baseLastOp) * 100 : 0;

        return { key: drv.key, name: drv.label, diff, rate };
      });

      driverImpacts.sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));

      setResult({
        months,
        basePredictions: basePreds,
        scenarioPredictions: scenarioPreds,
        driverImpacts,
      });

      setTimeout(() => {
        const el = resultRef.current;
        if (el) el.classList.add("forecast-result-visible");
      }, 50);
    } catch (err) {
      console.error(err);
      setError(err.message || "예측 실행 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // 시나리오 행 조작
  // ===============================
  const handleAddRow = () => {
    const usedKeys = new Set(scenarioRows.map((r) => r.driverKey));
    const candidate =
      DRIVER_OPTIONS.find((opt) => !usedKeys.has(opt.key)) || DRIVER_OPTIONS[0];

    setScenarioRows((prev) => [
      ...prev,
      { id: Date.now(), driverKey: candidate.key, value: "0" },
    ]);
  };

  const handleRowChange = (id, field, value) => {
    setScenarioRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveRow = (id) => {
    setScenarioRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleResetScenario = () => {
    setScenarioRows([
      { id: 1, driverKey: "원재료비", value: "0" },
      { id: 2, driverKey: "부재료비(전체)", value: "0" },
      { id: 3, driverKey: "급여(전체)", value: "0" },
      { id: 4, driverKey: "전력비", value: "0" },
      { id: 5, driverKey: "판관비(전체)", value: "0" },
    ]);
    setResult(null);
    setError(null);
    setSyncStatus(null);
  };

  // ===============================
  // 예측 결과 가공
  // ===============================
  const trendData = useMemo(() => {
    if (!result || !result.scenarioPredictions?.length) return [];
    return result.scenarioPredictions.map((p) => ({
      label: `${p["연도"]}-${String(p["월"]).padStart(2, "0")}`,
      영업이익: p["영업이익"] || 0,
      매출총이익: p["매출총이익"] || 0,
      당기순이익: p["당기순이익"] || 0,
    }));
  }, [result]);

  const kpiSummary = useMemo(() => {
    if (!result || !result.scenarioPredictions?.length || !result.basePredictions?.length)
      return null;

    const scenLast = result.scenarioPredictions[result.scenarioPredictions.length - 1];
    const baseLast = result.basePredictions[result.basePredictions.length - 1];

    const op = scenLast["영업이익"] || 0;
    const opBase = baseLast["영업이익"] || 0;
    const opDiff = op - opBase;
    const opRate = opBase ? (opDiff / opBase) * 100 : 0;

    const ni = scenLast["당기순이익"] || 0;
    const niBase = baseLast["당기순이익"] || 0;
    const niDiff = ni - niBase;
    const niRate = niBase ? (niDiff / niBase) * 100 : 0;

    const sga = scenLast["판매비와일반관리비"] || 0;
    const sgaBase = baseLast["판매비와일반관리비"] || 0;
    const sgaDiff = sga - sgaBase;
    const sgaRate = sgaBase ? (sgaDiff / sgaBase) * 100 : 0;

    return {
      year: scenLast["연도"],
      month: scenLast["월"],
      op,
      opDiff,
      opRate,
      ni,
      niDiff,
      niRate,
      sga,
      sgaDiff,
      sgaRate,
    };
  }, [result]);

  const impactChartData = useMemo(() => {
    if (!result || !result.driverImpacts?.length) return [];
    return result.driverImpacts.map((d, idx) => ({
      name: d.name,
      rate: d.rate,
      color: IMPACT_COLORS[idx % IMPACT_COLORS.length],
    }));
  }, [result]);

  const impactDomain = useMemo(() => {
    if (!impactChartData.length) return ["auto", "auto"];
    const maxAbs = impactChartData.reduce(
      (m, d) => Math.max(m, Math.abs(d.rate || 0)),
      0
    );
    if (!maxAbs) return ["auto", "auto"];
    const limit = maxAbs * 1.1;
    return [-limit, limit];
  }, [impactChartData]);

  const tableRows = useMemo(() => {
    if (!result || !result.scenarioPredictions?.length) return [];
    return result.scenarioPredictions.map((p, idx) => ({
      id: idx + 1,
      year: p["연도"],
      month: p["월"],
      op: p["영업이익"],
      gp: p["매출총이익"],
      ni: p["당기순이익"],
      sga: p["판매비와일반관리비"],
    }));
  }, [result]);

  // ===============================
  // PDF 내보내기
  // ===============================
  const handleExportPdf = async () => {
    if (!resultRef.current) return;

    try {
      const element = resultRef.current;
      element.classList.add("forecast-exporting");

      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        scrollX: 0,
        scrollY: -window.scrollY,
      });

      element.classList.remove("forecast-exporting");

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save("AI_미래결산_예측결과.pdf");
    } catch (err) {
      console.error(err);
      alert("PDF 생성 중 오류가 발생했습니다.");
    }
  };

  // ===============================
  // 렌더링
  // ===============================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`
        .forecast-fade-up {
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.55s ease-out, transform 0.55s ease-out;
        }
        .forecast-result-visible {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .forecast-exporting {
          box-shadow: none !important;
          transform: none !important;
        }
      `}</style>

      {/* 입력 카드 */}
      <section style={baseCardStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: BRAND_DARK }}>
          AI 기반 미래 결산 예측 (주요 비용 시나리오)
        </h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          전력비 · 급여(전체) · 원재료비 · 부재료비(전체) · 판관비(전체) 등 주요 비용 항목{" "}
          <span style={{ fontWeight: 600 }}>증감률 시나리오</span>를 입력하면,
          향후 n개월간의 영업이익 / 매출총이익 / 당기순이익 / 판관비를 예측합니다.
        </p>

        {/* 기간 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: BRAND_DARK, minWidth: 70 }}>
            예측 기간
          </span>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            style={{
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              padding: "7px 14px",
              fontSize: 13,
              outline: "none",
              boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
            }}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            ※ 예: 200% 입력 시 → 현재 수준의 2배로, 이후 모든 월에서 동일한 증가 비율을 가정합니다.
          </span>
        </div>

        {/* 시나리오 행 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {scenarioRows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 260px) 1fr 40px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <select
                value={row.driverKey}
                onChange={(e) => handleRowChange(row.id, "driverKey", e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  backgroundColor: "#f9fafb",
                }}
              >
                {DRIVER_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  padding: "6px 10px",
                  backgroundColor: "#fff",
                }}
              >
                <input
                  type="number"
                  value={row.value}
                  onChange={(e) => handleRowChange(row.id, "value", e.target.value)}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    fontSize: 13,
                    textAlign: "right",
                  }}
                />
                <span style={{ marginLeft: 4, fontSize: 13, color: "#6b7280" }}>%</span>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveRow(row.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                }}
                title="삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleAddRow}
              style={{
                borderRadius: 999,
                border: "1px dashed #d1d5db",
                padding: "7px 13px",
                fontSize: 12,
                backgroundColor: "#f9fafb",
                cursor: "pointer",
              }}
            >
              + 항목 추가
            </button>

            <button
              type="button"
              onClick={handleResetScenario}
              style={{
                borderRadius: 999,
                border: "none",
                padding: "7px 15px",
                fontSize: 12,
                backgroundColor: "#e5e7eb",
                color: "#374151",
                cursor: "pointer",
              }}
            >
              시나리오 초기화
            </button>

            <button
              type="button"
              onClick={handleSyncAndRetrain}
              disabled={syncLoading || loading}
              style={{
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                padding: "7px 14px",
                fontSize: 12,
                backgroundColor: syncLoading ? "#f3f4f6" : "#fff7ed",
                color: "#9a3412",
                cursor: syncLoading || loading ? "default" : "pointer",
                boxShadow: "0 8px 20px rgba(251,146,60,0.18)",
              }}
              title="report_data의 최신 결산을 5년치 데이터에 반영하고 Prophet 모델을 재학습합니다."
            >
              {syncLoading ? "요청 중..." : "최신 결산 반영 + 재학습"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleRunForecast}
            disabled={loading || syncLoading}
            style={{
              borderRadius: 999,
              border: "none",
              padding: "9px 22px",
              fontSize: 13,
              fontWeight: 600,
              background: "linear-gradient(135deg, #16a34a, " + BRAND_ORANGE + ")",
              color: "#ffffff",
              boxShadow: "0 12px 30px rgba(22,163,74,0.35)",
              cursor: loading || syncLoading ? "default" : "pointer",
              opacity: loading || syncLoading ? 0.7 : 1,
            }}
          >
            {loading ? "예측 중..." : "예측 실행"}
          </button>
        </div>

        {/* ✅ 재학습 상태 표시 */}
        {syncStatus && (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            {syncStatus.running && (
              <span style={{ color: "#f59e0b" }}>
                ⏳ 데이터 업데이트 및 재학습 진행 중입니다… (step: {syncStatus.step || "running"})
              </span>
            )}

            {!syncStatus.running && syncStatus.ok && (
              <span style={{ color: "#16a34a" }}>
                ✅ 최신 결산 반영 및 재학습이 완료되었습니다.
              </span>
            )}

            {!syncStatus.running && syncStatus.ok === false && (
              <span style={{ color: "#dc2626" }}>
                ❌ 재학습 실패: {syncStatus.error || "알 수 없는 오류"}
              </span>
            )}
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
            {error}
          </div>
        )}
      </section>

      {/* 결과 카드 */}
      <section style={{ ...baseCardStyle, position: "relative" }} ref={resultRef} className="forecast-fade-up">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: BRAND_DARK }}>
            예측 결과 (월별 추세 & 영향도)
          </h3>

          {result && (
            <button
              type="button"
              onClick={handleExportPdf}
              style={{
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                padding: "6px 14px",
                fontSize: 12,
                backgroundColor: "#f9fafb",
                cursor: "pointer",
              }}
            >
              PDF로 내보내기
            </button>
          )}
        </div>

        {!result && (
          <p style={{ fontSize: 12, color: "#9ca3af" }}>
            상단에서 시나리오를 입력한 뒤 <span style={{ fontWeight: 600 }}>“예측 실행”</span>을 눌러주세요.
          </p>
        )}

        {result && (
          <>
            {/* KPI 카드 */}
            {kpiSummary && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                {/* 영업이익 */}
                <div
                  style={{
                    borderRadius: 16,
                    padding: 12,
                    background: "linear-gradient(135deg, #ecfdf5, #dcfce7, #f0fdf4)",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#065f46", marginBottom: 4 }}>
                    {kpiSummary.year}년 {kpiSummary.month}월 영업이익
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#065f46" }}>
                    {fmt(kpiSummary.op)}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: kpiSummary.opDiff >= 0 ? "#16a34a" : "#b91c1c",
                    }}
                  >
                    {kpiSummary.opDiff >= 0 ? "▲" : "▼"} {fmt(Math.abs(kpiSummary.opDiff))} (
                    {kpiSummary.opRate >= 0 ? "+" : "-"}
                    {Math.abs(kpiSummary.opRate).toFixed(1)}%)
                  </div>
                </div>

                {/* 당기순이익 */}
                <div
                  style={{
                    borderRadius: 16,
                    padding: 12,
                    background: "linear-gradient(135deg, #eff6ff, #e0f2fe, #eef2ff)",
                    border: "1px solid #bfdbfe",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#1d4ed8", marginBottom: 4 }}>
                    {kpiSummary.year}년 {kpiSummary.month}월 당기순이익
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1d4ed8" }}>
                    {fmt(kpiSummary.ni)}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: kpiSummary.niDiff >= 0 ? "#2563eb" : "#b91c1c",
                    }}
                  >
                    {kpiSummary.niDiff >= 0 ? "▲" : "▼"} {fmt(Math.abs(kpiSummary.niDiff))} (
                    {kpiSummary.niRate >= 0 ? "+" : "-"}
                    {Math.abs(kpiSummary.niRate).toFixed(1)}%)
                  </div>
                </div>

                {/* 판관비 */}
                <div
                  style={{
                    borderRadius: 16,
                    padding: 12,
                    background: "linear-gradient(135deg, #fefce8, #fffbeb, #fef9c3)",
                    border: "1px solid #facc15",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#854d0e", marginBottom: 4 }}>
                    {kpiSummary.year}년 {kpiSummary.month}월 판관비(전체)
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#854d0e" }}>
                    {fmt(kpiSummary.sga)}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: kpiSummary.sgaDiff <= 0 ? "#16a34a" : "#b91c1c",
                    }}
                  >
                    {kpiSummary.sgaDiff <= 0 ? "▼" : "▲"} {fmt(Math.abs(kpiSummary.sgaDiff))} (
                    {kpiSummary.sgaRate >= 0 ? "+" : "-"}
                    {Math.abs(kpiSummary.sgaRate).toFixed(1)}%)
                  </div>
                </div>
              </div>
            )}

            {/* 이익 추세 + Impact */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.3fr)",
                gap: 16,
                marginBottom: 18,
              }}
            >
              {/* 이익 추세 */}
              <div style={{ borderRadius: 18, border: "1px solid #e5e7eb", padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: BRAND_DARK }}>
                  이익 추세 (영업이익 / 매출총이익 / 당기순이익)
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                  시나리오 적용 후 향후 월별 이익 흐름입니다. (단위: 억 원)
                </div>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={trendData} margin={{ top: 10, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={fmtHundredMillion} />
                      <Tooltip
                        formatter={(v) => (typeof v === "number" ? fmtHundredMillion(v) : v)}
                      />
                      <Legend content={renderTrendLegend} />
                      <Line
                        type="monotone"
                        dataKey="매출총이익"
                        name="매출총이익(시나리오)"
                        stroke={BRAND_GREEN}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="당기순이익"
                        name="당기순이익(시나리오)"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="영업이익"
                        name="영업이익(시나리오)"
                        stroke={BRAND_ORANGE}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Impact */}
              <div style={{ borderRadius: 18, border: "1px solid #e5e7eb", padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: BRAND_DARK }}>
                  항목별 영업이익 영향도 (Impact Ranking)
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                  각 항목만 단독으로 적용했을 때, <b>마지막 월 영업이익</b>이 기준 대비 얼마나 변하는지입니다. (단위: %)
                </div>

                <div style={{ display: "flex", width: "100%", height: 260, alignItems: "stretch", gap: 12 }}>
                  <div style={{ flex: "1 1 auto" }}>
                    <ResponsiveContainer>
                      <BarChart data={impactChartData} layout="vertical" margin={{ top: 10, right: 16, left: 40, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={impactDomain} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => `${v.toFixed(2)}%`} labelFormatter={(name) => `${name}`} />
                        <Bar dataKey="rate" radius={8} barSize={22} isAnimationActive animationDuration={700}>
                          {impactChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ width: 120, fontSize: 11, color: "#4b5563", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                    {impactChartData.map((item) => (
                      <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6, opacity: Math.abs(item.rate || 0) < 0.05 ? 0.5 : 1 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "999px", backgroundColor: item.color, boxShadow: "0 0 0 1px rgba(148,163,184,0.4)" }} />
                        <span style={{ whiteSpace: "nowrap" }}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 표 */}
            <div style={{ borderRadius: 16, border: "1px solid #e5e7eb", padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: BRAND_DARK }}>
                예측 결과 (월별 상세)
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
                시나리오 적용 후, 각 월의 주요 손익 항목입니다.
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>연도</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>월</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>영업이익</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>매출총이익</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>당기순이익</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>판관비(전체)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "6px 8px" }}>{row.year}</td>
                        <td style={{ padding: "6px 8px" }}>{row.month}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(row.op)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(row.gp)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(row.ni)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(row.sga)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default ForecastTab;
