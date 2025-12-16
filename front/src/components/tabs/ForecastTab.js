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
// ✅ [수정] 전력비 제거
const DRIVER_OPTIONS = [
  { key: "원재료비", label: "원재료비" },
  { key: "부재료비(전체)", label: "부재료비(전체)" }, // -> 부재료비_전체
  { key: "급여(전체)", label: "급여(전체)" }, // -> 총인건비
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

// ✅ 추세 Legend (순서 고정 + 가운데 정렬)
const renderTrendLegend = (props) => {
  const { payload } = props;
  if (!payload || !payload.length) return null;

  // ✅ 여기 순서를 화면에서 보이는 순서로 고정
  const order = ["매출액", "매출원가", "영업이익"];
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

  // ✅ [수정] 전력비 제거
  const [scenarioRows, setScenarioRows] = useState([
    { id: 1, driverKey: "원재료비", value: "0" },
    { id: 2, driverKey: "부재료비(전체)", value: "0" },
    { id: 3, driverKey: "급여(전체)", value: "0" },
    { id: 5, driverKey: "판관비(전체)", value: "0" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // ===============================
  // ✅ [주제4] 추세 그래프 표시 토글 (체크박스 Legend)
  //   - 한 축(YAxis)만 사용
  //   - 체크박스 변경 시: 선택된 라인 기준으로 Y축 domain 자동 조정
  // ===============================
  const [trendVisible, setTrendVisible] = useState({
    매출액: true,
    매출원가: true,
    영업이익: true,
  });

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
        throw new Error(
          data.error || `데이터 업데이트/재학습 시작 실패 (HTTP ${res.status})`
        );
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
      // -> 백엔드가 r=2.0을 '총배율'로 해석하고 base*(r-1)로 반영
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

        // ✅ 수정 포인트: baseLastOp가 음수면 부호가 뒤집혀 "좋게" 보일 수 있음
        // -> 분모를 abs(baseLastOp)로 써서 diff 부호를 그대로 유지
        const denom = Math.abs(baseLastOp);
        const rate = denom ? (diff / denom) * 100 : 0;

        const level = 100 + rate; // ✅ 기준(100%) 대비 '수준(%)'로 변환
        return { key: drv.key, name: drv.label, diff, rate, level };
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
    // ✅ [수정] 전력비 제거
    setScenarioRows([
      { id: 1, driverKey: "원재료비", value: "0" },
      { id: 2, driverKey: "부재료비(전체)", value: "0" },
      { id: 3, driverKey: "급여(전체)", value: "0" },
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
      매출액: p["매출액"] || 0,
      매출원가: p["매출원가계"] ?? p["매출원가"] ?? 0,
    }));
  }, [result]);

  // ===============================
  // ✅ [주제4] 추세 그래프: 선택된 라인 기준으로 Y축 domain 계산
  // ===============================
  const trendVisibleKeys = useMemo(() => {
    const keys = ["매출액", "매출원가", "영업이익"];
    return keys.filter((k) => trendVisible[k]);
  }, [trendVisible]);

  const trendYAxisDomain = useMemo(() => {
    if (!trendData.length) return ["auto", "auto"];

    const keys = trendVisibleKeys.length ? trendVisibleKeys : ["매출액"];

    let minV = Infinity;
    let maxV = -Infinity;

    for (const row of trendData) {
      for (const k of keys) {
        const v = typeof row?.[k] === "number" ? row[k] : 0;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    }

    if (!isFinite(minV) || !isFinite(maxV)) return ["auto", "auto"];

    // ✅ 여유 margin(10%) + 0 근처 잘 보이도록 보정
    const range = Math.max(1, maxV - minV);
    const pad = range * 0.1;
    let lo = minV - pad;
    let hi = maxV + pad;

    // 값이 전부 양수/전부 음수일 때도 0 기준이 너무 멀지 않게 약간 보정
    if (lo > 0) lo = Math.max(0, lo - pad);
    if (hi < 0) hi = Math.min(0, hi + pad);

    return [lo, hi];
  }, [trendData, trendVisibleKeys]);

  // ✅ [주제4] 체크박스 Legend 렌더러 (기존 renderTrendLegend는 유지)
  const renderTrendLegendCheckbox = (props) => {
    const { payload } = props;
    if (!payload || !payload.length) return null;

    // ✅ 고정 순서
    const order = ["매출액", "매출원가", "영업이익"];
    const ordered = order
      .map((key) => payload.find((item) => item.dataKey === key))
      .filter(Boolean);

    const toggleKey = (k) => {
      setTrendVisible((prev) => {
        const next = { ...prev, [k]: !prev[k] };
        // ✅ 최소 1개는 남기기 (전부 꺼지면 그래프가 의미 없어짐)
        const anyOn = Object.values(next).some(Boolean);
        return anyOn ? next : prev;
      });
    };

    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          marginTop: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: 11,
          }}
        >
          {ordered.map((item) => {
            const key = item.dataKey;
            const checked = !!trendVisible[key];

            return (
              <label
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  userSelect: "none",
                  opacity: checked ? 1 : 0.45,
                }}
                title="클릭해서 표시/숨기기"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleKey(key)}
                  style={{ cursor: "pointer" }}
                />
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "999px",
                    backgroundColor: item.color,
                    display: "inline-block",
                  }}
                />
                <span>{item.value}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const kpiSummary = useMemo(() => {
    if (
      !result ||
      !result.scenarioPredictions?.length ||
      !result.basePredictions?.length
    )
      return null;

    const scenLast =
      result.scenarioPredictions[result.scenarioPredictions.length - 1];
    const baseLast = result.basePredictions[result.basePredictions.length - 1];

    const op = scenLast["영업이익"] || 0;
    const opBase = baseLast["영업이익"] || 0;
    const opDiff = op - opBase;
    const opRateDenom = Math.abs(opBase);
    const opRate = opRateDenom ? (opDiff / opRateDenom) * 100 : 0; // ✅ 여기서도 통일

    const sales = scenLast["매출액"] || 0;
    const salesBase = baseLast["매출액"] || 0;
    const salesDiff = sales - salesBase;
    const salesRate = salesBase ? (salesDiff / salesBase) * 100 : 0;

    const cogs = scenLast["매출원가계"] ?? scenLast["매출원가"] ?? 0;
    const cogsBase = baseLast["매출원가계"] ?? baseLast["매출원가"] ?? 0;
    const cogsDiff = cogs - cogsBase;
    const cogsRate = cogsBase ? (cogsDiff / cogsBase) * 100 : 0;

    return {
      year: scenLast["연도"],
      month: scenLast["월"],
      op,
      opDiff,
      opRate,
      sales,
      salesDiff,
      salesRate,
      cogs,
      cogsDiff,
      cogsRate,
    };
  }, [result]);

  const impactChartData = useMemo(() => {
    if (!result || !result.driverImpacts?.length) return [];
    // ✅ 전력비를 결과에서 혹시 내려줘도(예외 케이스) 프론트에서 한 번 더 제거
    return result.driverImpacts
      .filter((d) => d?.name !== "전력비" && d?.key !== "전력비")
      .map((d, idx) => ({
        name: d.name,
        level: d.level,
        delta: d.rate,
        color: IMPACT_COLORS[idx % IMPACT_COLORS.length],
      }));
  }, [result]);

  const impactDomain = useMemo(() => {
    if (!impactChartData.length) return ["auto", "auto"];

    // ✅ '수준(%)' 기준으로 X축 범위 계산 (기준선 100% 포함)
    const vals = impactChartData
      .map((d) => Number(d.level || 0))
      .filter((v) => Number.isFinite(v));

    if (!vals.length) return ["auto", "auto"];

    const minV = Math.min(...vals, 100);
    const maxV = Math.max(...vals, 100);

    // 약간의 패딩(너무 타이트하지 않게)
    const pad = Math.max((maxV - minV) * 0.1, 5);
    return [minV - pad, maxV + pad];
  }, [impactChartData]);

  const tableRows = useMemo(() => {
    if (!result || !result.scenarioPredictions?.length) return [];
    return result.scenarioPredictions.map((p, idx) => ({
      id: idx + 1,
      year: p["연도"],
      month: p["월"],
      op: p["영업이익"],
      sales: p["매출액"],
      cogs: p["매출원가계"] ?? p["매출원가"],
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
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 6,
            color: BRAND_DARK,
          }}
        >
          AI 기반 미래 결산 예측 (주요 비용 시나리오)
        </h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          {/* ✅ [수정] 전력비 문구 제거 */}
          급여(전체) · 원재료비 · 부재료비(전체) · 판관비(전체) 등 주요 비용 항목{" "}
          <span style={{ fontWeight: 600 }}>증감률 시나리오</span>를 입력하면,
          향후 n개월간의 영업이익 / 매출액 / 매출원가를 예측합니다.
        </p>

        {/* 기간 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: BRAND_DARK,
              minWidth: 70,
            }}
          >
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 16,
          }}
        >
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
                onChange={(e) =>
                  handleRowChange(row.id, "driverKey", e.target.value)
                }
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
                  onChange={(e) =>
                    handleRowChange(row.id, "value", e.target.value)
                  }
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    fontSize: 13,
                    textAlign: "right",
                  }}
                />
                <span style={{ marginLeft: 4, fontSize: 13, color: "#6b7280" }}>
                  %
                </span>
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
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
                ⏳ 데이터 업데이트 및 재학습 진행 중입니다… (step:{" "}
                {syncStatus.step || "running"})
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
      <section
        style={{ ...baseCardStyle, position: "relative" }}
        ref={resultRef}
        className="forecast-fade-up"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
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
            상단에서 시나리오를 입력한 뒤{" "}
            <span style={{ fontWeight: 600 }}>“예측 실행”</span>을 눌러주세요.
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
                    background:
                      "linear-gradient(135deg, #ecfdf5, #dcfce7, #f0fdf4)",
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
                    {kpiSummary.opDiff >= 0 ? "▲" : "▼"}{" "}
                    {fmt(Math.abs(kpiSummary.opDiff))} (
                    {kpiSummary.opRate >= 0 ? "+" : "-"}
                    {Math.abs(kpiSummary.opRate).toFixed(1)}%)
                  </div>
                </div>

                {/* 매출액 */}
                <div
                  style={{
                    borderRadius: 16,
                    padding: 12,
                    background: "linear-gradient(135deg, #eff6ff, #e0f2fe, #eef2ff)",
                    border: "1px solid #bfdbfe",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#1d4ed8", marginBottom: 4 }}>
                    {kpiSummary.year}년 {kpiSummary.month}월 매출액
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1d4ed8" }}>
                    {fmt(kpiSummary.sales)}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: kpiSummary.salesDiff >= 0 ? "#2563eb" : "#b91c1c",
                    }}
                  >
                    {kpiSummary.salesDiff >= 0 ? "▲" : "▼"}{" "}
                    {fmt(Math.abs(kpiSummary.salesDiff))} (
                    {kpiSummary.salesRate >= 0 ? "+" : "-"}
                    {Math.abs(kpiSummary.salesRate).toFixed(1)}%)
                  </div>
                </div>

                {/* 매출원가 */}
                <div
                  style={{
                    borderRadius: 16,
                    padding: 12,
                    background: "linear-gradient(135deg, #fefce8, #fffbeb, #fef9c3)",
                    border: "1px solid #facc15",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#854d0e", marginBottom: 4 }}>
                    {kpiSummary.year}년 {kpiSummary.month}월 매출원가
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#854d0e" }}>
                    {fmt(kpiSummary.cogs)}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: kpiSummary.cogsDiff <= 0 ? "#16a34a" : "#b91c1c",
                    }}
                  >
                    {kpiSummary.cogsDiff <= 0 ? "▼" : "▲"}{" "}
                    {fmt(Math.abs(kpiSummary.cogsDiff))} (
                    {kpiSummary.cogsRate >= 0 ? "+" : "-"}
                    {Math.abs(kpiSummary.cogsRate).toFixed(1)}%)
                  </div>
                </div>
              </div>
            )}

            {/* 추세 + Impact */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.3fr)",
                gap: 16,
                marginBottom: 18,
              }}
            >
              {/* 추세 */}
              <div style={{ borderRadius: 18, border: "1px solid #e5e7eb", padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: BRAND_DARK }}>
                  추세 (영업이익 / 매출액 / 매출원가)
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                  시나리오 적용 후 향후 월별 주요 지표 흐름입니다. (단위: 억 원)
                </div>

                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={trendData} margin={{ top: 10, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />

                      <YAxis tickFormatter={fmtHundredMillion} domain={trendYAxisDomain} />

                      <Tooltip
                        formatter={(v) =>
                          typeof v === "number" ? fmtHundredMillion(v) : v
                        }
                      />
                      <Legend content={renderTrendLegendCheckbox} />

                      <Line
                        type="monotone"
                        dataKey="매출액"
                        name="매출액(시나리오)"
                        stroke={BRAND_GREEN}
                        strokeWidth={2}
                        dot={false}
                        hide={!trendVisible["매출액"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="매출원가"
                        name="매출원가(시나리오)"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        hide={!trendVisible["매출원가"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="영업이익"
                        name="영업이익(시나리오)"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        hide={!trendVisible["영업이익"]}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Impact */}
              <div style={{ borderRadius: 18, border: "1px solid #e5e7eb", padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: BRAND_DARK }}>
                  항목별 영업이익 수준 (기준=100%, %)
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                  각 비용을 <b>하나씩만</b> 적용해 봤을 때, <b>마지막 달 영업이익</b>이 기준(100%) 대비 어느 수준인지 보여줍니다. (단위: %)
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
                  예) <b>원재료비 -75%</b> → 원재료비만 반영했을 때, 마지막 달 영업이익이 기준(100%)보다 낮아져 <b>-75%</b> 수준이 된다는 뜻입니다.
                </div>

                <div style={{ display: "flex", width: "100%", height: 260, alignItems: "stretch", gap: 12 }}>
                  <div style={{ flex: "1 1 auto" }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={impactChartData}
                        layout="vertical"
                        margin={{ top: 10, right: 16, left: 40, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          domain={impactDomain}
                          tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(v) => {
                            const lv = Number(v);
                            const delta = lv - 100;
                            const sign = delta >= 0 ? "+" : "";
                            return `${lv.toFixed(1)}% (Δ ${sign}${delta.toFixed(1)}%)`;
                          }}
                          labelFormatter={(name) => `${name}`}
                        />
                        <Bar
                          dataKey="level"
                          radius={8}
                          barSize={22}
                          isAnimationActive
                          animationDuration={700}
                        >
                          {impactChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div
                    style={{
                      width: 120,
                      fontSize: 11,
                      color: "#4b5563",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    {impactChartData.map((item) => (
                      <div
                        key={item.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          opacity: Math.abs(item.delta || 0) < 0.05 ? 0.5 : 1,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "999px",
                            backgroundColor: item.color,
                            boxShadow: "0 0 0 1px rgba(148,163,184,0.4)",
                          }}
                        />
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
                      <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>매출액</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>매출원가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "6px 8px" }}>{row.year}</td>
                        <td style={{ padding: "6px 8px" }}>{row.month}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(row.op)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(row.sales)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(row.cogs)}</td>
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
