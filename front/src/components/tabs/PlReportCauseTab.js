import React, { useEffect, useMemo, useState } from "react";

/* =========================
 * Numbers
 * ========================= */
function formatNumber(v) {
  if (v === null || v === undefined || v === "") return "-";
  const num = Number(v);
  if (Number.isNaN(num)) return "-";
  return Math.round(num).toLocaleString("ko-KR");
}
function formatSignedNumber(v) {
  const num = Number(v);
  if (Number.isNaN(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return sign + Math.round(num).toLocaleString("ko-KR");
}
function formatRate(v) {
  const num = Number(v);
  if (Number.isNaN(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/* =========================
 * Path helpers
 * ========================= */
function splitPath(pathStr) {
  if (!pathStr) return [];
  return String(pathStr)
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
}
function joinPath(parts) {
  return (parts || []).join(" > ");
}
function normalizeItem(raw) {
  const path = raw?.path ? String(raw.path) : null;
  const name = raw?.name ? String(raw.name) : null;

  const cur = safeNum(raw?.cur ?? 0);
  const prev = safeNum(raw?.prev ?? 0);
  const diff = safeNum(raw?.diff ?? (cur - prev));
  const rate =
    typeof raw?.rate !== "undefined" && raw?.rate !== null
      ? safeNum(raw.rate)
      : prev
      ? (diff / prev) * 100
      : diff
      ? 100
      : 0;

  return { path, name, cur, prev, diff, rate, _raw: raw };
}

function buildChildrenFromPathItems(flatItems, prefixParts) {
  const depth = prefixParts.length;

  const under = flatItems.filter((it) => {
    if (!it.path) return false;
    const parts = splitPath(it.path);
    if (parts.length <= depth) return false;
    for (let i = 0; i < depth; i++) {
      if (parts[i] !== prefixParts[i]) return false;
    }
    return true;
  });

  // childName 별로 합산
  const agg = new Map();
  for (const it of under) {
    const parts = splitPath(it.path);
    const childName = parts[depth];
    if (!childName) continue;
    if (!agg.has(childName)) agg.set(childName, { cur: 0, prev: 0, diff: 0, n: 0 });
    const a = agg.get(childName);
    a.cur += safeNum(it.cur);
    a.prev += safeNum(it.prev);
    a.diff += safeNum(it.diff);
    a.n += 1;
  }

  const out = Array.from(agg.entries()).map(([childName, a]) => {
    const rate = a.prev ? (a.diff / a.prev) * 100 : a.diff ? 100 : 0;
    return { name: childName, cur: a.cur, prev: a.prev, diff: a.diff, rate, _cnt: a.n };
  });

  out.sort((a, b) => Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff)));
  return out;
}
function hasDeeperLevel(flatItems, prefixParts) {
  const depth = prefixParts.length;
  return flatItems.some((it) => {
    if (!it.path) return false;
    const parts = splitPath(it.path);
    if (parts.length <= depth) return false;
    for (let i = 0; i < depth; i++) {
      if (parts[i] !== prefixParts[i]) return false;
    }
    return true;
  });
}

/* =========================
 * ✅ “기대 드릴다운 트리” (엑셀/보고서 제목 기반)
 * - 제목만 참고해서 “CEO가 기대하는” 하위 항목을 정의
 * - 네 report_test.py / 엑셀 구조대로 계속 확장 가능
 * ========================= */
const PL_TREE = {
  // 매출
  매출액: ["국내매출액", "수출매출액"],
  국내매출액: [
    "판매수량(국내)",
    "제품매출",
    "상품매출",
    "설비매출",
    "시작차매출",
    "부산물매출 (영업)",
    "부산물매출",
    "기타매출",
    "기타매출(금창)",
    "사급",
  ],
  수출매출액: ["판매수량(수출)", "제품매출", "상품매출", "설비매출", "기타매출"],

  // 원가
  매출원가계: ["국내매출원가", "수출매출원가"],
  국내매출원가: ["제품", "상품", "기타"],
  수출매출원가: ["제품", "상품", "기타"],

  // 판관비
  판매비와일반관리비: ["급여", "퇴직급여", "복리후생비", "감가상각비", "지급수수료", "운반비", "광고선전비", "기타"],
};

/* =========================
 * Colors / emphasis
 * ========================= */
function toneForValue(v) {
  const n = safeNum(v);
  if (n > 0) return "pos";
  if (n < 0) return "neg";
  return "zero";
}
function barColor(v, maxAbs) {
  const n = safeNum(v);
  const m = Math.max(1e-9, safeNum(maxAbs, 1));
  const t = clamp(Math.abs(n) / m, 0, 1);

  // 강한 대비(양: 오렌지/레드 계열, 음: 그린 계열)
  if (n >= 0) {
    if (t > 0.75) return "#EF4444"; // 강한 +
    if (t > 0.45) return "#F97316";
    return "#FDBA74";
  } else {
    if (t > 0.75) return "#059669"; // 강한 -
    if (t > 0.45) return "#22C55E";
    return "#86EFAC";
  }
}
function bgForRank(rank) {
  // 0~2만 살짝 하이라이트
  if (rank === 0) return "linear-gradient(180deg,#FFF7ED 0%, #FFFFFF 70%)";
  if (rank === 1) return "linear-gradient(180deg,#F0FDFA 0%, #FFFFFF 70%)";
  if (rank === 2) return "linear-gradient(180deg,#EFF6FF 0%, #FFFFFF 70%)";
  return "#FFFFFF";
}

/* =========================
 * UI bits
 * ========================= */
function Chip({ children, tone = "neutral", title }) {
  const toneStyle =
    tone === "dark"
      ? { background: "#111827", color: "#fff", border: "1px solid #111827" }
      : tone === "blue"
      ? { background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }
      : tone === "amber"
      ? { background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }
      : tone === "red"
      ? { background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }
      : tone === "green"
      ? { background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }
      : { background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" };

  return (
    <span
      title={title || ""}
      style={{
        ...toneStyle,
        fontSize: 11,
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 950,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Button({ children, onClick, disabled, tone = "solid", title }) {
  const base = {
    fontSize: 12,
    padding: "9px 12px",
    borderRadius: 14,
    fontWeight: 950,
    cursor: disabled ? "not-allowed" : "pointer",
    userSelect: "none",
    border: "1px solid transparent",
    opacity: disabled ? 0.55 : 1,
    transition: "transform 120ms ease, box-shadow 120ms ease",
  };

  const style =
    tone === "outline"
      ? { ...base, background: "#fff", color: "#111827", border: "1px solid #111827" }
      : tone === "ghost"
      ? { ...base, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }
      : { ...base, background: "#111827", color: "#fff", border: "1px solid #111827", boxShadow: "0 10px 24px rgba(15,23,42,0.16)" };

  return (
    <button
      type="button"
      title={title || ""}
      onClick={disabled ? undefined : onClick}
      style={style}
      onMouseDown={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}

function Bar({ value, maxAbs, height = 12 }) {
  const v = safeNum(value);
  const m = Math.max(1e-9, safeNum(maxAbs, 1));
  const w = (Math.abs(v) / m) * 100;
  const width = clamp(w, 0, 100);

  return (
    <div style={{ height, borderRadius: 999, background: "#EEF2F7", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: barColor(v, m),
        }}
      />
    </div>
  );
}

function Card({ title, right, children, tone = "default" }) {
  const toneStyle =
    tone === "hero"
      ? {
          background: "linear-gradient(135deg,#0B1220 0%, #111827 50%, #1F2937 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "#fff",
          boxShadow: "0 22px 60px rgba(0,0,0,0.30)",
        }
      : tone === "info"
      ? {
          background: "linear-gradient(180deg,#EFF6FF 0%, #FFFFFF 60%)",
          border: "1px solid #BFDBFE",
          boxShadow: "0 18px 44px rgba(15,23,42,0.09)",
        }
      : tone === "soft"
      ? {
          background: "linear-gradient(180deg,#F9FAFB 0%, #FFFFFF 60%)",
          border: "1px solid #E5E7EB",
          boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
        }
      : {
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          boxShadow: "0 16px 40px rgba(15,23,42,0.07)",
        };

  return (
    <div style={{ ...toneStyle, borderRadius: 20, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 980, color: tone === "hero" ? "#fff" : "#111827" }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* =========================
 * Executive Summary
 * ========================= */
function buildExecutiveSummary({ activeKpi, driver, drilldowns, currentLabel, previousLabel, kpiCard }) {
  if (!driver) return null;

  const kpiDiff = safeNum(driver.kpi_diff);
  const sortedComponents = (driver.components || [])
    .slice()
    .sort((a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib)));

  const topComponent = sortedComponents[0] || null;
  const secondComponent = sortedComponents[1] || null;

  const topComponentKey = topComponent?.component;
  const topComponentSubs = topComponentKey ? drilldowns?.[topComponentKey] || [] : [];
  const topSub = topComponentSubs[0] || null;

  const direction = kpiDiff >= 0 ? "증가" : "감소";
  const kpiRateText =
    kpiCard && typeof kpiCard.rate !== "undefined" && kpiCard.rate !== null ? `(${formatRate(safeNum(kpiCard.rate))})` : "";

  const lines = [];
  if (currentLabel && previousLabel) {
    lines.push(`${currentLabel}의 ${activeKpi}은(는) ${previousLabel} 대비 ${formatSignedNumber(kpiDiff)} ${direction} ${kpiRateText}`.trim());
  } else {
    lines.push(`${activeKpi}은(는) 전월 대비 ${formatSignedNumber(kpiDiff)} ${direction}했습니다.`);
  }

  if (topComponent) {
    lines.push(`핵심 원인: **${topComponent.component}** 변화가 KPI에 ${formatSignedNumber(safeNum(topComponent.contrib))}만큼 기여`);
  }
  if (secondComponent) {
    lines.push(`보조 원인: **${secondComponent.component}** 기여 ${formatSignedNumber(safeNum(secondComponent.contrib))}`);
  }
  if (topSub) {
    lines.push(`세부 Top: ${topComponentKey} 내 **${topSub.name}**가 ${formatSignedNumber(safeNum(topSub.diff))} (${formatRate(safeNum(topSub.rate))}) 변동`);
  } else if (topComponentKey) {
    lines.push(`세부 분해 제한: ${topComponentKey} 하위 데이터가 API에 없거나 키가 불일치합니다.`);
  }

  return { title: `Executive Summary — ${activeKpi} ${direction} 원인`, lines, topComponentKey: topComponentKey || null };
}

/* =========================
 * Story generators (문구 핵심)
 * ========================= */
function pickTopMoves(list, k = 3) {
  const arr = (list || []).slice().sort((a, b) => Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff)));
  return arr.slice(0, k);
}
function sumAbsDiff(list) {
  return (list || []).reduce((acc, x) => acc + Math.abs(safeNum(x.diff)), 0);
}
function buildNodeStory({ nodeLabel, parentDiff, list }) {
  if (!nodeLabel) return [];
  const lines = [];

  const total = safeNum(parentDiff);
  const absTotal = Math.abs(total);
  const top3 = pickTopMoves(list, 3);

  if (!list || list.length === 0) {
    lines.push(`**${nodeLabel}** 하위 분해 데이터가 없습니다. (leaf이거나 하위 데이터 누락 가능)`);
    return lines;
  }

  // “집중도”
  const denom = absTotal > 0 ? absTotal : sumAbsDiff(list) || 1;
  const c1 = top3[0] ? (Math.abs(safeNum(top3[0].diff)) / denom) * 100 : 0;
  const c2 = top3[1] ? (Math.abs(safeNum(top3[1].diff)) / denom) * 100 : 0;

  const dir = total >= 0 ? "증가" : "감소";
  lines.push(`**${nodeLabel}**는 전월 대비 ${formatSignedNumber(total)} ${dir}했습니다.`);
  if (top3[0]) {
    const t = top3[0];
    lines.push(
      `가장 큰 변동은 **${t.name}** (${formatSignedNumber(t.diff)}, ${formatRate(safeNum(t.rate))})이며, 현재 노드 변동의 약 **${formatRate(c1)}** 수준을 설명합니다.`
    );
  }
  if (top3[1]) {
    const t = top3[1];
    lines.push(`2순위는 **${t.name}** (${formatSignedNumber(t.diff)})로 영향이 큽니다. (누적 집중도 약 ${formatRate(c1 + c2)})`);
  }

  // sign 혼재(상쇄) 경고
  const pos = list.filter((x) => safeNum(x.diff) > 0).reduce((a, x) => a + safeNum(x.diff), 0);
  const neg = list.filter((x) => safeNum(x.diff) < 0).reduce((a, x) => a + Math.abs(safeNum(x.diff)), 0);
  if (pos > 0 && neg > 0) {
    const cancelRatio = Math.min(pos, neg) / Math.max(1, Math.max(pos, neg));
    if (cancelRatio > 0.35) {
      lines.push(`⚠️ 하위 항목 내 **증가/감소가 크게 섞여 상쇄**됩니다. “합계만 보면 정상처럼 보이는 착시” 가능성이 있어 세부 확인이 필요합니다.`);
    }
  }

  return lines;
}

/* =========================
 * Auto Trace: 영향 큰 경로를 leaf까지
 * ========================= */
function autoTracePath({ getChildren, getHasNext, startParts, maxDepth = 10 }) {
  const trace = [{ parts: startParts.slice(), label: startParts[startParts.length - 1], value: null }];
  let curParts = startParts.slice();

  for (let step = 0; step < maxDepth; step++) {
    const children = getChildren(curParts);
    if (!children || children.length === 0) break;

    const top = children
      .slice()
      .sort((a, b) => Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff)))[0];
    if (!top) break;

    const nextParts = [...curParts, top.name];
    const node = { parts: nextParts, label: top.name, value: top };

    trace.push(node);
    if (!getHasNext(nextParts)) break;

    curParts = nextParts;
  }

  return trace;
}

/* =========================
 * Main
 * ========================= */
export default function PlReportCauseTab() {
  const [periods, setPeriods] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [causeData, setCauseData] = useState(null);

  const [activeKpi, setActiveKpi] = useState("영업이익");
  const [drillStack, setDrillStack] = useState([]);
  const [activeComponent, setActiveComponent] = useState(null);
  const [autoTrace, setAutoTrace] = useState(null);

  // periods
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const res = await fetch("/api/pl-cause/periods");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const list = data.periods || [];
        setPeriods(list);
        if (list.length > 0) {
          const last = list[list.length - 1];
          setSelectedYear(last.year);
          setSelectedMonth(last.month);
        }
      } catch (err) {
        setError(err.message || "원인 분석 기간 목록 조회 오류");
      }
    };
    fetchPeriods();
  }, []);

  // cause fetch
  useEffect(() => {
    if (!selectedYear || !selectedMonth) return;
    const fetchCause = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth) }).toString();
        const res = await fetch(`/api/pl-cause?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setCauseData(data);
        setActiveComponent(null);
        setDrillStack([]);
        setAutoTrace(null);
      } catch (err) {
        setError(err.message || "원인 분석 조회 실패");
        setCauseData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchCause();
  }, [selectedYear, selectedMonth]);

  const yearOptions = useMemo(() => Array.from(new Set(periods.map((p) => p.year))).sort((a, b) => a - b), [periods]);
  const monthOptions = useMemo(
    () => periods.filter((p) => p.year === selectedYear).sort((a, b) => a.month - b.month),
    [periods, selectedYear]
  );

  const handleYearChange = (e) => {
    const y = Number(e.target.value || 0);
    if (!y) {
      setSelectedYear(null);
      setSelectedMonth(null);
      return;
    }
    setSelectedYear(y);
    const monthsForYear = periods.filter((p) => p.year === y).sort((a, b) => a.month - b.month);
    setSelectedMonth(monthsForYear.length ? monthsForYear[monthsForYear.length - 1].month : null);
  };
  const handleMonthChange = (e) => setSelectedMonth(Number(e.target.value || 0) || null);

  const kpiCards = causeData?.kpi_cards || [];
  const drivers = causeData?.drivers || {};
  const driver = drivers?.[activeKpi] || null;

  const backendDrilldowns = causeData?.drilldowns || {};
  const flatItems = useMemo(() => {
    const src = causeData?.all_items || causeData?.items || causeData?.top_items || [];
    return (src || []).map(normalizeItem).filter((x) => x.path && x.path.length > 0);
  }, [causeData]);

  const activeKpiCard = useMemo(() => (kpiCards || []).find((x) => x.name === activeKpi) || null, [kpiCards, activeKpi]);

  const driverMaxAbs = useMemo(() => {
    if (!driver?.components?.length) return 0;
    return Math.max(...driver.components.map((c) => Math.abs(safeNum(c.contrib))));
  }, [driver]);

  const currentDrill = drillStack.length ? drillStack[drillStack.length - 1] : null;

  // children getter (backend 우선, 없으면 path 기반)
  const getChildren = useMemo(() => {
    return (prefixParts) => {
      const keyName = prefixParts[prefixParts.length - 1];

      const backendList = backendDrilldowns?.[keyName];
      if (Array.isArray(backendList) && backendList.length > 0) {
        return backendList
          .map((x) => ({
            name: String(x.name),
            cur: safeNum(x.cur),
            prev: safeNum(x.prev),
            diff: safeNum(x.diff),
            rate:
              typeof x.rate !== "undefined" && x.rate !== null
                ? safeNum(x.rate)
                : safeNum(x.prev)
                ? (safeNum(x.diff) / safeNum(x.prev)) * 100
                : safeNum(x.diff)
                ? 100
                : 0,
          }))
          .slice()
          .sort((a, b) => Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff)));
      }

      if (!flatItems.length) return [];
      return buildChildrenFromPathItems(flatItems, prefixParts);
    };
  }, [backendDrilldowns, flatItems]);

  const getHasNext = useMemo(() => {
    return (parts) => {
      const last = parts[parts.length - 1];
      if (backendDrilldowns?.[last] && backendDrilldowns[last].length > 0) return true;
      if (!flatItems.length) return false;
      return hasDeeperLevel(flatItems, parts);
    };
  }, [backendDrilldowns, flatItems]);

  const currentDrillList = useMemo(() => {
    if (!currentDrill) return [];
    return getChildren(currentDrill.parts);
  }, [currentDrill, getChildren]);

  const drillMaxAbs = useMemo(() => {
    if (!currentDrillList?.length) return 0;
    return Math.max(...currentDrillList.map((x) => Math.abs(safeNum(x.diff))));
  }, [currentDrillList]);

  // KPI 바꾸면 top component 자동 포커스
  useEffect(() => {
    if (!driver?.components?.length) return;
    const top = driver.components
      .slice()
      .sort((a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib)))[0];
    if (!top) return;
    setAutoTrace(null);
    setActiveComponent(top.component);
    setDrillStack([{ key: joinPath([top.component]), label: top.component, parts: [top.component] }]);
  }, [activeKpi, driver]);

  const executiveSummary = useMemo(() => {
    return buildExecutiveSummary({
      activeKpi,
      driver,
      drilldowns: backendDrilldowns,
      currentLabel: causeData?.current_period?.label || null,
      previousLabel: causeData?.previous_period?.label || null,
      kpiCard: activeKpiCard,
    });
  }, [activeKpi, driver, backendDrilldowns, causeData, activeKpiCard]);

  // “현재 레벨”에서 parentDiff 추정 (가능하면 API가 parent 값을 내려줘야 정확)
  const parentTotalDiff = useMemo(() => currentDrillList.reduce((acc, x) => acc + safeNum(x.diff), 0), [currentDrillList]);

  // 기대 하위 / Missing 진단
  const expectedChildren = useMemo(() => {
    if (!currentDrill) return [];
    return PL_TREE[currentDrill.label] || [];
  }, [currentDrill]);

  const availableChildNames = useMemo(() => currentDrillList.map((x) => x.name), [currentDrillList]);

  const missingChildren = useMemo(() => {
    const set = new Set(availableChildNames);
    return expectedChildren.filter((n) => !set.has(n));
  }, [expectedChildren, availableChildNames]);

  // node story(문장)
  const nodeStoryLines = useMemo(() => {
    if (!currentDrill) return [];
    return buildNodeStory({ nodeLabel: currentDrill.label, parentDiff: parentTotalDiff, list: currentDrillList });
  }, [currentDrill, parentTotalDiff, currentDrillList]);

  // driver story(문장)
  const driverStoryLines = useMemo(() => {
    if (!driver?.components?.length) return [];
    const sorted = driver.components.slice().sort((a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib)));
    const top = sorted[0];
    const second = sorted[1];
    const lines = [];
    lines.push(`이번 달 **${activeKpi}** 변화의 1순위 원인은 **${top?.component || "-"}** 입니다.`);
    if (top) {
      lines.push(`→ ${top.component}의 KPI 기여는 **${formatSignedNumber(safeNum(top.contrib))}** (전월 ${formatNumber(top.prev)} → 당월 ${formatNumber(top.cur)}) 입니다.`);
    }
    if (second) {
      lines.push(`2순위는 **${second.component}**로 **${formatSignedNumber(safeNum(second.contrib))}** 만큼 영향을 줬습니다.`);
    }
    lines.push(`이제 우측에서 “드릴다운”을 내려가면, **어떤 하위 항목이 실제로 숫자를 만들었는지**가 문장+색으로 바로 보입니다.`);
    return lines;
  }, [driver, activeKpi]);

  // Auto trace 실행
  const runAutoTrace = () => {
    if (!drillStack.length) return;
    const startParts = drillStack[0]?.parts || null;
    if (!startParts || !startParts.length) return;

    const trace = autoTracePath({ getChildren, getHasNext, startParts, maxDepth: 12 });
    setAutoTrace(trace);

    // UI도 trace의 마지막으로 이동
    setDrillStack(
      trace.map((t) => ({
        key: joinPath(t.parts),
        label: t.label,
        parts: t.parts,
      }))
    );
  };

  // “조건별” 데이터 자동 감지 (백엔드가 내려주면 표시)
  // 예: causeData.segment_drilldowns, causeData.by_condition, causeData.conditional_views 등
  const conditionBlocks = useMemo(() => {
    const c =
      causeData?.by_condition ||
      causeData?.conditions ||
      causeData?.conditional_views ||
      causeData?.segment_views ||
      null;

    // 기대 포맷(예시):
    // { "대표차종": { "AVANTE": { kpi_cards, drivers, drilldowns }, ... }, "유통경로": {...} }
    if (!c || typeof c !== "object") return [];

    const blocks = [];
    for (const [condKey, condVal] of Object.entries(c)) {
      if (!condVal || typeof condVal !== "object") continue;
      const entries = Object.entries(condVal).slice(0, 6); // 너무 길면 상위 6개만
      blocks.push({
        condKey,
        entries: entries.map(([name, payload]) => ({ name, payload })),
      });
    }
    return blocks;
  }, [causeData]);

  const showFatal = !periods.length && !!error;
  const kpiTabs = ["매출총이익", "영업이익", "당기순이익"];
  const topKpiNames = ["매출액", "매출총이익", "영업이익", "당기순이익", "매출원가계", "판매비와일반관리비"];

  const dataDepth = causeData?.all_items || causeData?.items ? "DEEP" : "SHALLOW";
  const depthTone = dataDepth === "DEEP" ? "green" : "amber";

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* HERO HEADER */}
      <Card
        tone="hero"
        title="P&L 원인 분석 (CEO View)"
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={selectedYear || ""}
              onChange={handleYearChange}
              style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.25)", fontWeight: 950, background: "rgba(255,255,255,0.10)", color: "#fff" }}
            >
              <option value="">연도</option>
              {yearOptions.map((y) => (
                <option key={y} value={y} style={{ color: "#111827" }}>
                  {y}년
                </option>
              ))}
            </select>

            <select
              value={selectedMonth || ""}
              onChange={handleMonthChange}
              disabled={!selectedYear || monthOptions.length === 0}
              style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.25)", fontWeight: 950, background: "rgba(255,255,255,0.10)", color: "#fff" }}
            >
              <option value="">월</option>
              {monthOptions.map((p) => (
                <option key={`${p.year}-${p.month}`} value={p.month} style={{ color: "#111827" }}>
                  {String(p.month).padStart(2, "0")}월
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 1.55 }}>
            그래프를 “해석”하지 말고, <b>문장으로 원인을 읽는 화면</b>으로 만들었다.  
            좌측은 공식 분해(Driver), 우측은 손익계산서 계층 드릴다운 + <b>원인 스토리</b> + <b>누락 진단</b>이다.
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {causeData?.current_period && <Chip tone="dark">현재: {causeData.current_period.label}</Chip>}
            {causeData?.previous_period && <Chip tone="neutral">전월: {causeData.previous_period.label}</Chip>}
            <Chip tone={depthTone} title="items/all_items가 있으면 leaf까지 드릴다운이 깊어집니다.">
              data depth: {dataDepth}
            </Chip>
            <Chip tone="blue" title="KPI → Driver → Drilldown → 원인 스토리">
              mode: CEO summary
            </Chip>
          </div>
        </div>
      </Card>

      {showFatal && <div style={{ color: "#ef4444", fontWeight: 950 }}>{error}</div>}
      {!showFatal && (
        <>
          {loading && <div style={{ fontSize: 12, color: "#6B7280" }}>불러오는 중...</div>}
          {error && !loading && <div style={{ color: "#ef4444", fontWeight: 950 }}>{error}</div>}

          {!loading && !error && causeData && (
            <>
              {/* Executive Summary */}
              {executiveSummary && (
                <Card
                  tone="info"
                  title="📌 Executive Summary"
                  right={executiveSummary.topComponentKey ? <Chip tone="blue">핵심: {executiveSummary.topComponentKey}</Chip> : null}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.75 }}>
                      <div style={{ fontWeight: 980, marginBottom: 8 }}>{executiveSummary.title}</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {executiveSummary.lines.map((l, i) => (
                          <li key={i} style={{ marginBottom: 8 }}>
                            {String(l).split("**").map((seg, idx) =>
                              idx % 2 === 1 ? (
                                <span key={idx} style={{ fontWeight: 980 }}>
                                  {seg}
                                </span>
                              ) : (
                                <span key={idx}>{seg}</span>
                              )
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 18, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 980, marginBottom: 8 }}>🧠 지금 화면이 해주는 일</div>
                      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                        1) KPI 변화량을 Driver로 분해  
                        <br />
                        2) Driver 클릭 → 드릴다운으로 “원인 경로” 내려감  
                        <br />
                        3) 우측에 <b>원인 스토리(문장)</b> 자동 생성  
                        <br />
                        4) 누락(마감 미완) 가능성은 <b>Missing</b>으로 바로 표시
                      </div>
                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Chip tone="green">문장</Chip>
                        <Chip tone="amber">누락진단</Chip>
                        <Chip tone="blue">경로추적</Chip>
                        <Chip tone="red">리스크</Chip>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {kpiCards
                  .filter((x) => topKpiNames.includes(x.name))
                  .slice(0, 6)
                  .map((k) => (
                    <div
                      key={k.name}
                      style={{
                        background: "linear-gradient(180deg,#FFFFFF 0%, #F9FAFB 100%)",
                        border: "1px solid #E5E7EB",
                        borderRadius: 20,
                        padding: 14,
                        boxShadow: "0 14px 34px rgba(15,23,42,0.06)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div style={{ fontSize: 12, fontWeight: 980 }}>{k.name}</div>
                        <div style={{ fontSize: 16, fontWeight: 980 }}>{formatNumber(k.cur)}</div>
                      </div>
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7280" }}>
                        <span>전월 {formatNumber(k.prev)}</span>
                        <span style={{ fontWeight: 980, color: "#111827" }}>
                          {formatSignedNumber(k.diff)} ({formatRate(safeNum(k.rate))})
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* KPI Tabs */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {kpiTabs.map((k) => (
                  <Button key={k} tone={activeKpi === k ? "solid" : "ghost"} onClick={() => setActiveKpi(k)}>
                    {k} 원인 분석
                  </Button>
                ))}
              </div>

              {/* Story (Driver) */}
              <Card
                tone="soft"
                title="📝 KPI 원인 스토리 (읽기만 하면 결론이 보이게)"
                right={<Chip tone="neutral" title="좌측 Driver + 우측 Drilldown을 바탕으로 자동 문장 생성">auto narrative</Chip>}
              >
                {driverStoryLines.length ? (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                    {driverStoryLines.map((t, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: 12, color: "#6B7280" }}>Driver 데이터가 없습니다.</div>
                )}
              </Card>

              {/* Layout: Drivers + Drilldown */}
              <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 12 }}>
                {/* Left: drivers */}
                <Card
                  tone="default"
                  title={`${activeKpi} 변화 요인 (공식 분해)`}
                  right={driver ? <Chip tone="neutral">전월 대비 {formatSignedNumber(safeNum(driver.kpi_diff))}</Chip> : null}
                >
                  {!driver ? (
                    <div style={{ fontSize: 12, color: "#6B7280" }}>드라이버 없음</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {driver.components.map((c, idx) => {
                        const isActive = activeComponent === c.component;
                        const prev = safeNum(c.prev);
                        const diff = safeNum(c.diff);
                        const rate = prev ? (diff / prev) * 100 : diff ? 100 : 0;

                        return (
                          <div
                            key={c.component}
                            onClick={() => {
                              setAutoTrace(null);
                              setActiveComponent(c.component);
                              setDrillStack([{ key: joinPath([c.component]), label: c.component, parts: [c.component] }]);
                            }}
                            style={{
                              padding: 14,
                              borderRadius: 20,
                              border: isActive ? "1px solid #111827" : "1px solid #E5E7EB",
                              background: bgForRank(idx),
                              cursor: "pointer",
                              boxShadow: isActive ? "0 18px 44px rgba(15,23,42,0.12)" : "0 10px 26px rgba(15,23,42,0.06)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                              <div style={{ fontSize: 13, fontWeight: 980, minWidth: 0 }}>
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.component}</span>
                                <span style={{ marginLeft: 8, fontSize: 11, color: "#6B7280" }}>
                                  (KPI 기여 {formatSignedNumber(safeNum(c.contrib))})
                                </span>
                              </div>
                              <Chip tone={toneForValue(c.contrib) === "pos" ? "red" : toneForValue(c.contrib) === "neg" ? "green" : "neutral"}>
                                기여 {formatSignedNumber(safeNum(c.contrib))}
                              </Chip>
                            </div>

                            <div style={{ marginTop: 10 }}>
                              <Bar value={safeNum(c.contrib)} maxAbs={driverMaxAbs} height={12} />
                            </div>

                            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7280" }}>
                              <span>전월 {formatNumber(prev)} → 당월 {formatNumber(safeNum(c.cur))}</span>
                              <span style={{ fontWeight: 980, color: "#111827" }}>
                                변화 {formatSignedNumber(diff)} ({formatRate(rate)})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* Right: drilldown + narrative + missing */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Card
                    title={drillStack.length ? `드릴다운 — ${drillStack[drillStack.length - 1].label}` : "드릴다운 (세부 원인)"}
                    right={
                      drillStack.length ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <Chip tone={backendDrilldowns?.[drillStack[drillStack.length - 1].label]?.length ? "blue" : flatItems.length ? "green" : "amber"}>
                            source: {backendDrilldowns?.[drillStack[drillStack.length - 1].label]?.length ? "backend" : flatItems.length ? "path" : "-"}
                          </Chip>

                          {/* breadcrumb */}
                          <Button
                            tone="ghost"
                            disabled={drillStack.length <= 1}
                            onClick={() => {
                              setAutoTrace(null);
                              setDrillStack(drillStack.slice(0, -1));
                            }}
                          >
                            ◀ 뒤로
                          </Button>

                          <Button
                            tone="outline"
                            disabled={!drillStack.length}
                            onClick={runAutoTrace}
                            title="현재 선택된 구성요소에서 ‘가장 영향 큰 경로’를 leaf까지 자동 추적"
                          >
                            ⛓️ Auto Trace
                          </Button>
                        </div>
                      ) : (
                        <Chip tone="neutral">좌측 구성요소 클릭</Chip>
                      )
                    }
                  >
                    {!drillStack.length ? (
                      <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.65 }}>
                        좌측 Driver(예: 매출액/매출원가계/판관비)를 클릭하면, 우측에 하위 항목이 뜬다.  
                        여기서는 <b>Top 항목을 색/뱃지로 강조</b>하고, 아래에 <b>원인 스토리(문장)</b>가 자동으로 붙는다.
                      </div>
                    ) : currentDrillList.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.65 }}>
                        지금 레벨에서 하위 분해 데이터가 없습니다(leaf 또는 누락).  
                        아래 “세부 원인 진단”에서 Missing을 확인하세요.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {/* AutoTrace 결과 카드 */}
                        {autoTrace && autoTrace.length > 1 && (
                          <div
                            style={{
                              border: "1px dashed #c7d2fe",
                              background: "linear-gradient(180deg,#EEF2FF 0%, #FFFFFF 70%)",
                              padding: 12,
                              borderRadius: 18,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                              <div style={{ fontWeight: 980, color: "#111827" }}>🧩 원인 트리 (자동 경로)</div>
                              <Chip tone="blue">leaf까지</Chip>
                            </div>
                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                              {autoTrace.map((t, idx) => {
                                const v = t.value;
                                return (
                                  <div key={joinPath(t.parts)} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                    <span style={{ color: "#1f2937" }}>
                                      {idx === 0 ? "Start" : `L${idx}`} : <b>{t.label}</b>
                                    </span>
                                    <span style={{ fontWeight: 980, color: "#3730a3" }}>
                                      {v ? `${formatSignedNumber(safeNum(v.diff))} (${formatRate(safeNum(v.rate))})` : ""}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Drill list */}
                        {currentDrillList.map((x, idx) => {
                          const nextParts = [...(currentDrill?.parts || []), x.name];
                          const hasNext = getHasNext(nextParts);

                          // “기여율”은 parentTotalDiff(근사) 기준
                          const contribPct = parentTotalDiff ? (safeNum(x.diff) / parentTotalDiff) * 100 : 0;

                          const rankTone = idx === 0 ? "red" : idx === 1 ? "green" : idx === 2 ? "blue" : "neutral";
                          const signTone = toneForValue(x.diff) === "pos" ? "red" : toneForValue(x.diff) === "neg" ? "green" : "neutral";

                          return (
                            <div
                              key={joinPath(nextParts)}
                              onClick={() => {
                                if (!hasNext) return;
                                setAutoTrace(null);
                                setDrillStack([...drillStack, { key: joinPath(nextParts), label: x.name, parts: nextParts }]);
                              }}
                              style={{
                                padding: 12,
                                borderRadius: 20,
                                border: "1px solid #E5E7EB",
                                background: bgForRank(idx),
                                cursor: hasNext ? "pointer" : "default",
                                boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "baseline", minWidth: 0 }}>
                                  <Chip tone={rankTone}>TOP {idx + 1}</Chip>
                                  <div style={{ fontSize: 13, fontWeight: 980, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {x.name}
                                  </div>
                                  {hasNext ? <Chip tone="dark">drill ▶</Chip> : <Chip tone="neutral">leaf</Chip>}
                                </div>

                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <Chip tone={signTone}>
                                    {formatSignedNumber(safeNum(x.diff))} ({formatRate(safeNum(x.rate))})
                                  </Chip>
                                </div>
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <Bar value={safeNum(x.diff)} maxAbs={drillMaxAbs} height={12} />
                              </div>

                              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7280" }}>
                                <span>전월 {formatNumber(safeNum(x.prev))} / 당월 {formatNumber(safeNum(x.cur))}</span>
                                <span style={{ fontWeight: 980, color: "#111827" }}>기여율 {formatRate(contribPct)}</span>
                              </div>

                              {/* ✅ “문장” 한 줄 박아주기 */}
                              <div style={{ marginTop: 10, fontSize: 12, color: "#111827", lineHeight: 1.6 }}>
                                {safeNum(x.diff) >= 0 ? (
                                  <>
                                    <b>{x.name}</b>가 늘면서 현재 노드 변동을 <b>끌어올렸고</b>, KPI에 긍정 기여 가능성이 큽니다.
                                  </>
                                ) : (
                                  <>
                                    <b>{x.name}</b>가 감소/악화되면서 현재 노드 변동을 <b>끌어내렸고</b>, KPI를 훼손했을 가능성이 큽니다.
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  {/* ✅ 원인 스토리 (현재 노드 기준) */}
                  <Card
                    tone="soft"
                    title="🧾 세부 원인 스토리 (현재 선택 노드 기준)"
                    right={currentDrill ? <Chip tone="neutral">노드: {currentDrill.label}</Chip> : <Chip tone="neutral">노드 선택 필요</Chip>}
                  >
                    {!currentDrill ? (
                      <div style={{ fontSize: 12, color: "#6B7280" }}>좌측에서 구성요소를 먼저 클릭하세요. (예: 매출액, 매출원가계, 판매비와일반관리비)</div>
                    ) : (
                      <>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                          {nodeStoryLines.map((l, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>{l}</li>
                          ))}
                        </ul>

                        {missingChildren.length > 0 && (
                          <div style={{ marginTop: 12, padding: 12, borderRadius: 18, border: "1px solid #FDE68A", background: "#FFFBEB" }}>
                            <div style={{ fontWeight: 980, color: "#92400E", marginBottom: 8 }}>⚠️ 누락 가능(마감/매핑/데이터 미반영 의심)</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {missingChildren.slice(0, 20).map((n) => (
                                <Chip key={n} tone="amber" title="PL_TREE 기준으로는 있어야 하는데 현재 하위 데이터에 없음">
                                  {n}
                                </Chip>
                              ))}
                            </div>
                            <div style={{ marginTop: 8, fontSize: 11, color: "#9CA3AF", lineHeight: 1.55 }}>
                              * 이 리스트는 “프론트가 못 그린” 게 아니라, <b>API에 하위 데이터가 없거나 키/매핑이 불일치</b>해서 생깁니다.  
                              * 오늘 마감용으로는 이 Missing을 “마감 미완/계정 누락” 알람으로 바로 써먹을 수 있습니다.
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </Card>

                  {/* ✅ 조건별(차종/손익센터/유통경로) — 데이터가 있으면 보여주기 */}
                  <Card
                    tone="default"
                    title="📊 조건별 CEO 뷰 (차종/손익센터/유통경로 등)"
                    right={<Chip tone="neutral" title="백엔드가 조건별 분해 데이터를 내려주면 자동 표시됩니다.">auto detect</Chip>}
                  >
                    {conditionBlocks.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.65 }}>
                        현재 API 응답에 <b>조건별 분해 데이터</b>가 없습니다.  
                        (예: 차종별 매출 기여, 손익센터별 판관비 상세, 유통경로별 이상치 등)  
                        <div style={{ marginTop: 8, fontSize: 11, color: "#9CA3AF" }}>
                          → 백엔드에서 `by_condition` 같은 형태로 내려주면, 여기서 자동으로 “조건별 Executive Summary”가 뜹니다.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {conditionBlocks.map((blk) => (
                          <div key={blk.condKey} style={{ border: "1px solid #E5E7EB", borderRadius: 18, padding: 12, background: "#fff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                              <div style={{ fontWeight: 980 }}>{blk.condKey}</div>
                              <Chip tone="blue">{blk.entries.length}개 상위 항목</Chip>
                            </div>

                            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                              {blk.entries.map(({ name, payload }) => {
                                const kpiCards2 = payload?.kpi_cards || [];
                                const drivers2 = payload?.drivers || {};
                                const d2 = drivers2?.[activeKpi] || null;
                                const curKpi = kpiCards2.find((x) => x.name === activeKpi) || null;

                                const topDriver =
                                  d2?.components?.slice().sort((a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib)))[0] || null;

                                return (
                                  <div key={name} style={{ border: "1px solid #E5E7EB", borderRadius: 18, padding: 12, background: "linear-gradient(180deg,#F9FAFB 0%, #FFFFFF 70%)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                                      <div style={{ fontWeight: 980, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                                      {curKpi ? (
                                        <Chip tone={safeNum(curKpi.diff) >= 0 ? "red" : "green"}>
                                          {formatSignedNumber(safeNum(curKpi.diff))} ({formatRate(safeNum(curKpi.rate))})
                                        </Chip>
                                      ) : (
                                        <Chip tone="amber">no kpi</Chip>
                                      )}
                                    </div>

                                    <div style={{ marginTop: 10, fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                                      {topDriver ? (
                                        <>
                                          이 조건에서 <b>{activeKpi}</b> 변화의 핵심은 <b>{topDriver.component}</b>이며, KPI에{" "}
                                          <b>{formatSignedNumber(safeNum(topDriver.contrib))}</b> 기여했습니다.
                                        </>
                                      ) : (
                                        <>Driver 정보가 없습니다. (백엔드 조건별 drivers 필요)</>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </div>

              {/* 참고: 전체 변화 Top */}
              <Card title="참고 — 전체 항목 중 전월 대비 변동 Top">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(causeData.top_items || []).slice(0, 10).map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 12,
                        padding: "8px 10px",
                        borderRadius: 14,
                        border: "1px solid #E5E7EB",
                        background: "#fff",
                      }}
                    >
                      <span style={{ color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.path}</span>
                      <span style={{ fontWeight: 980, color: "#111827" }}>
                        {formatSignedNumber(safeNum(t.diff))} ({formatRate(safeNum(t.rate))})
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10, fontSize: 11, color: "#9CA3AF", lineHeight: 1.55 }}>
                  * “세부 원인”이 안 내려가는 경우는 대부분 <b>API가 items/all_items(상세 path)</b>를 주지 않기 때문입니다.  
                  * 지금 코드는 backend drilldowns가 부족해도 <b>path</b> 기반으로 최대한 계층을 재구성해 내려가게 설계했습니다.
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
