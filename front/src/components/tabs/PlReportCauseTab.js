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
 * ✅ 기대 드릴다운 트리 (보고서 구조 기반)
 * ========================= */
const PL_TREE = {
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
  매출원가계: ["국내매출원가", "수출매출원가"],
  국내매출원가: ["제품", "상품", "기타"],
  수출매출원가: ["제품", "상품", "기타"],
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

  if (n >= 0) {
    if (t > 0.75) return "#DC2626";
    if (t > 0.45) return "#EA580C";
    return "#FDBA74";
  }
  if (t > 0.75) return "#047857";
  if (t > 0.45) return "#16A34A";
  return "#86EFAC";
}

/* =========================
 * ✅ Main-like (각진) UI Kit
 * ========================= */
const UI = {
  radius: 8,
  radiusSm: 6,
  border: "1px solid #E5E7EB",
  shadow: "0 1px 2px rgba(15,23,42,0.06)",
  bg: "#FFFFFF",
  bgSoft: "#F9FAFB",
  text: "#111827",
  subText: "#6B7280",
};

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
        borderRadius: UI.radiusSm,
        fontWeight: 900,
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

function Button({ children, onClick, disabled, tone = "solid", title, style: styleProp }) {
  const base = {
    fontSize: 12,
    padding: "9px 12px",
    borderRadius: UI.radius,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    userSelect: "none",
    border: "1px solid transparent",
    opacity: disabled ? 0.55 : 1,
    transition: "transform 80ms ease",
  };

  const style =
    tone === "outline"
      ? { ...base, background: "#fff", color: UI.text, border: "1px solid #111827" }
      : tone === "ghost"
      ? { ...base, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }
      : { ...base, background: "#111827", color: "#fff", border: "1px solid #111827" };

  return (
    <button
      type="button"
      title={title || ""}
      onClick={disabled ? undefined : onClick}
      style={{ ...style, ...(styleProp || {}) }}
      onMouseDown={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "scale(0.99)";
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

function Bar({ value, maxAbs, height = 10 }) {
  const v = safeNum(value);
  const m = Math.max(1e-9, safeNum(maxAbs, 1));
  const w = (Math.abs(v) / m) * 100;
  const width = clamp(w, 0, 100);

  return (
    <div style={{ height, borderRadius: UI.radiusSm, background: "#EEF2F7", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${width}%`, background: barColor(v, m) }} />
    </div>
  );
}

function Card({ title, right, children, tone = "default" }) {
  const toneStyle =
    tone === "soft"
      ? { background: UI.bgSoft, border: UI.border, boxShadow: UI.shadow }
      : tone === "info"
      ? { background: "#EFF6FF", border: "1px solid #BFDBFE", boxShadow: UI.shadow }
      : tone === "warn"
      ? { background: "#FFFBEB", border: "1px solid #FDE68A", boxShadow: UI.shadow }
      : { background: UI.bg, border: UI.border, boxShadow: UI.shadow };

  return (
    <div style={{ ...toneStyle, borderRadius: UI.radius, padding: 14 }}>
      {(title || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: UI.text }}>{title}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/* =========================
 * ✅ ESLint-safe tone helpers
 * ========================= */
function chipToneBySignedValue(v) {
  const t = toneForValue(v);
  if (t === "pos") return "red";
  if (t === "neg") return "green";
  return "neutral";
}
function chipToneForSource(hasBackend, hasPath) {
  if (hasBackend) return "blue";
  if (hasPath) return "green";
  return "amber";
}
function chipToneForImpact(impact) {
  const a = Math.abs(safeNum(impact));
  if (a >= 50) return safeNum(impact) >= 0 ? "red" : "green";
  if (a >= 20) return "blue";
  return "neutral";
}

/* =========================
 * Auto Trace
 * ========================= */
function autoTracePath({ getChildren, getHasNext, startParts, maxDepth = 10 }) {
  const trace = [{ parts: startParts.slice(), label: startParts[startParts.length - 1], value: null }];
  let curParts = startParts.slice();

  for (let step = 0; step < maxDepth; step++) {
    const children = getChildren(curParts);
    if (!children || children.length === 0) break;

    const top = children.slice().sort((a, b) => Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff)))[0];
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
 * ✅ Top “전월 대비 분석” Table
 * ========================= */
function MetricCompareTable({ title = "전월 대비 분석", metrics = [] }) {
  return (
    <Card tone="soft" title={title} right={<Chip tone="blue">당월 / 전월 / 증감 / 증감률</Chip>}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, metrics.length)}, minmax(0, 1fr))`, gap: 10 }}>
        {metrics.map((m) => {
          const signTone = safeNum(m.diff) >= 0 ? "red" : "green";
          return (
            <div key={m.key} style={{ border: UI.border, borderRadius: UI.radius, background: "#fff", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 950, color: UI.text }}>{m.label}</div>
                <Chip tone={signTone}>
                  {formatSignedNumber(safeNum(m.diff))} ({formatRate(safeNum(m.rate))})
                </Chip>
              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ border: UI.border, borderRadius: UI.radiusSm, padding: "8px 10px", background: UI.bgSoft }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: UI.text }}>당월</div>
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 950, color: UI.text }}>{formatNumber(m.cur)}</div>
                </div>
                <div style={{ border: UI.border, borderRadius: UI.radiusSm, padding: "8px 10px", background: UI.bgSoft }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: UI.text }}>전월</div>
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 950, color: UI.text }}>{formatNumber(m.prev)}</div>
                </div>
                <div style={{ gridColumn: "1 / span 2", marginTop: 2 }}>
                  <Bar value={safeNum(m.diff)} maxAbs={Math.max(1, Math.abs(safeNum(m.diff))) || 1} height={10} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* =========================
 * ✅ Period helpers
 * ========================= */
function toPeriodKey(y, m) {
  const mm = String(m).padStart(2, "0");
  return `${y}-${mm}`;
}
function parsePeriodKey(key) {
  const s = String(key || "");
  const [yy, mm] = s.split("-");
  const y = Number(yy);
  const m = Number(mm);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return { year: y, month: m };
}

/* =========================
 * Main
 * ========================= */
export default function PlReportCauseTab() {
  const [periods, setPeriods] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // ✅ 드롭다운용(연+월)
  const [selectedPeriod, setSelectedPeriod] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [causeData, setCauseData] = useState(null);

  const [activeKpi, setActiveKpi] = useState("영업이익");
  const [drillStack, setDrillStack] = useState([]);
  const [activeComponent, setActiveComponent] = useState(null);
  const [autoTrace, setAutoTrace] = useState(null);

  // CEO 가독성 옵션
  const [showAllChildren, setShowAllChildren] = useState(false);
  const [childFilter, setChildFilter] = useState("");
  const [sortMode, setSortMode] = useState("absdiff"); // absdiff | impact | rate

  /* periods */
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
          setSelectedPeriod(toPeriodKey(last.year, last.month)); // ✅ 기본값: 최신월
        }
      } catch (err) {
        setError(err.message || "원인 분석 기간 목록 조회 오류");
      }
    };
    fetchPeriods();
  }, []);

  // ✅ 드롭다운 변경 시 year/month 동기화
  useEffect(() => {
    if (!selectedPeriod) return;
    const parsed = parsePeriodKey(selectedPeriod);
    if (!parsed) return;
    setSelectedYear(parsed.year);
    setSelectedMonth(parsed.month);
  }, [selectedPeriod]);

  /* cause fetch */
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
        setShowAllChildren(false);
        setChildFilter("");
        setSortMode("absdiff");
      } catch (err) {
        setError(err.message || "원인 분석 조회 실패");
        setCauseData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchCause();
  }, [selectedYear, selectedMonth]);

  // ✅ 드롭다운 옵션(YYYY-MM)
  const periodOptions = useMemo(() => {
    return (periods || [])
      .slice()
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
      .map((p) => {
        const key = toPeriodKey(p.year, p.month);
        return { key, label: `${p.year}-${String(p.month).padStart(2, "0")}` };
      });
  }, [periods]);

  const kpiCards = causeData?.kpi_cards || [];
  const drivers = causeData?.drivers || {};
  const driver = drivers?.[activeKpi] || null;

  const backendDrilldowns = causeData?.drilldowns || {};
  const flatItems = useMemo(() => {
    const src = causeData?.all_items || causeData?.items || causeData?.top_items || [];
    return (src || []).map(normalizeItem).filter((x) => x.path && x.path.length > 0);
  }, [causeData]);

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

  const rawCurrentDrillList = useMemo(() => {
    if (!currentDrill) return [];
    return getChildren(currentDrill.parts);
  }, [currentDrill, getChildren]);

  // Parent 요약(하위 합)
  const parentSummary = useMemo(() => {
    if (!currentDrill) return null;
    if (!rawCurrentDrillList.length) return { cur: 0, prev: 0, diff: 0, rate: 0 };
    const cur = rawCurrentDrillList.reduce((a, x) => a + safeNum(x.cur), 0);
    const prev = rawCurrentDrillList.reduce((a, x) => a + safeNum(x.prev), 0);
    const diff = cur - prev;
    const rate = prev ? (diff / prev) * 100 : diff ? 100 : 0;
    return { cur, prev, diff, rate };
  }, [currentDrill, rawCurrentDrillList]);

  const drillMaxAbs = useMemo(() => {
    const list = rawCurrentDrillList || [];
    if (!list.length) return 0;
    return Math.max(...list.map((x) => Math.abs(safeNum(x.diff))));
  }, [rawCurrentDrillList]);

  // KPI 바꾸면 top component 자동 포커스
  useEffect(() => {
    if (!driver?.components?.length) return;
    const top = driver.components.slice().sort((a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib)))[0];
    if (!top) return;

    setAutoTrace(null);
    setActiveComponent(top.component);
    setDrillStack([{ key: joinPath([top.component]), label: top.component, parts: [top.component] }]);
    setShowAllChildren(false);
    setChildFilter("");
    setSortMode("absdiff");
  }, [activeKpi, driver]);

  // 기대 하위 / Missing 진단
  const expectedChildren = useMemo(() => {
    if (!currentDrill) return [];
    return PL_TREE[currentDrill.label] || [];
  }, [currentDrill]);

  const availableChildNames = useMemo(() => rawCurrentDrillList.map((x) => x.name), [rawCurrentDrillList]);
  const missingChildren = useMemo(() => {
    const set = new Set(availableChildNames);
    return expectedChildren.filter((n) => !set.has(n));
  }, [expectedChildren, availableChildNames]);

  // 필터/정렬 + Impact 계산
  const currentDrillList = useMemo(() => {
    const list = (rawCurrentDrillList || []).map((x) => {
      const pd = safeNum(parentSummary?.diff);
      const impact = pd ? (safeNum(x.diff) / pd) * 100 : 0;
      return { ...x, impact };
    });

    const q = String(childFilter || "").trim().toLowerCase();
    const filtered = q ? list.filter((x) => String(x.name).toLowerCase().includes(q)) : list;

    const sorted = filtered.slice().sort((a, b) => {
      if (sortMode === "impact") return Math.abs(safeNum(b.impact)) - Math.abs(safeNum(a.impact));
      if (sortMode === "rate") return Math.abs(safeNum(b.rate)) - Math.abs(safeNum(a.rate));
      return Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff)));
    });

    if (showAllChildren) return sorted;
    return sorted.slice(0, 8);
  }, [rawCurrentDrillList, parentSummary, childFilter, showAllChildren, sortMode]);

  // Auto trace 실행
  const runAutoTrace = () => {
    if (!drillStack.length) return;
    const startParts = drillStack[0]?.parts || null;
    if (!startParts || !startParts.length) return;

    const trace = autoTracePath({ getChildren, getHasNext, startParts, maxDepth: 12 });
    setAutoTrace(trace);
    setDrillStack(trace.map((t) => ({ key: joinPath(t.parts), label: t.label, parts: t.parts })));
  };

  // 조건별 데이터 자동 감지
  const conditionBlocks = useMemo(() => {
    const c = causeData?.by_condition || causeData?.conditions || causeData?.conditional_views || causeData?.segment_views || null;
    if (!c || typeof c !== "object") return [];
    const blocks = [];
    for (const [condKey, condVal] of Object.entries(c)) {
      if (!condVal || typeof condVal !== "object") continue;
      const entries = Object.entries(condVal).slice(0, 6);
      blocks.push({ condKey, entries: entries.map(([name, payload]) => ({ name, payload })) });
    }
    return blocks;
  }, [causeData]);

  const showFatal = !periods.length && !!error;
  const kpiTabs = ["매출총이익", "영업이익", "당기순이익"];
  const topKpiNames = ["매출액", "매출총이익", "영업이익", "당기순이익", "매출원가계", "판매비와일반관리비"];

  const dataDepth = causeData?.all_items || causeData?.items ? "DEEP" : "SHALLOW";
  const depthTone = dataDepth === "DEEP" ? "green" : "amber";

  // ✅ 상단 “전월 대비 분석” 표용 지표 구성
  const kpiMap = useMemo(() => {
    const map = new Map();
    (kpiCards || []).forEach((k) => map.set(String(k.name), k));
    return map;
  }, [kpiCards]);

  const topCompareMetrics = useMemo(() => {
    const pick = (name, label) => {
      const k = kpiMap.get(name);
      const cur = safeNum(k?.cur);
      const prev = safeNum(k?.prev);
      const diff = safeNum(k?.diff ?? (cur - prev));
      const rate =
        typeof k?.rate !== "undefined" && k?.rate !== null
          ? safeNum(k.rate)
          : prev
          ? (diff / prev) * 100
          : diff
          ? 100
          : 0;
      return { key: name, label, cur, prev, diff, rate };
    };

    return [pick("판매비와일반관리비", "당월/전월 영업비용"), pick("매출원가계", "당월/전월 매출원가"), pick("매출액", "당월/전월 매출액")];
  }, [kpiMap]);

  // ✅ 드릴다운 Breadcrumb 점프
  const jumpToLevel = (idx) => {
    if (idx < 0) return;
    setAutoTrace(null);
    setDrillStack(drillStack.slice(0, idx + 1));
    setShowAllChildren(false);
    setChildFilter("");
    setSortMode("absdiff");
  };

  // ✅ “비용 중심” 바로가기
  const focusOnOpex = () => {
    setActiveKpi("영업이익");
    setAutoTrace(null);
    setActiveComponent("판매비와일반관리비");
    setDrillStack([{ key: joinPath(["판매비와일반관리비"]), label: "판매비와일반관리비", parts: ["판매비와일반관리비"] }]);
    setShowAllChildren(false);
    setChildFilter("");
    setSortMode("absdiff");
  };

  // ✅ Month 드롭다운 UI(대시보드 우측 상단 pill 느낌)
  const MonthSelect = (
    <select
      value={selectedPeriod || ""}
      onChange={(e) => setSelectedPeriod(e.target.value)}
      style={{
        height: 34,
        padding: "0 12px",
        borderRadius: 999,
        border: "1px solid #E5E7EB",
        background: "#FFFFFF",
        color: "#111827",
        fontWeight: 900,
        fontSize: 12,
        outline: "none",
        cursor: "pointer",
      }}
    >
      {periodOptions.map((p) => (
        <option key={p.key} value={p.key}>
          Month: {p.label}
        </option>
      ))}
    </select>
  );

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ✅ 상단 헤더: 연/월 버튼 제거 + Month 드롭다운만 */}
      <Card
        title="P&L 원인 분석"
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {MonthSelect}

            <Chip tone={depthTone} title="items/all_items가 있으면 leaf까지 드릴다운이 깊어집니다.">
              depth: {dataDepth}
            </Chip>

            <Button tone="outline" onClick={focusOnOpex} title="영업비용(판관비)부터 바로 드릴다운">
              비용 중심 보기
            </Button>
          </div>
        }
      >
        {/* 기간 라벨 */}
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: UI.subText,
            lineHeight: 1.6,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {causeData?.current_period && <Chip tone="dark">현재: {causeData.current_period.label}</Chip>}
          {causeData?.previous_period && <Chip tone="neutral">전월: {causeData.previous_period.label}</Chip>}
          <Chip tone="blue">KPI → Driver → Drilldown → (Impact/Rate)</Chip>
        </div>
      </Card>

      {showFatal && <div style={{ color: "#ef4444", fontWeight: 900 }}>{error}</div>}

      {!showFatal && (
        <>
          {loading && <div style={{ fontSize: 12, color: UI.subText }}>불러오는 중...</div>}
          {error && !loading && <div style={{ color: "#ef4444", fontWeight: 900 }}>{error}</div>}

          {!loading && !error && causeData && (
            <>
              {/* ✅ 전월 대비 분석 */}
              <MetricCompareTable title="전월 대비 분석" metrics={topCompareMetrics} />

              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                {kpiCards
                  .filter((x) => topKpiNames.includes(x.name))
                  .slice(0, 6)
                  .map((k) => (
                    <div
                      key={k.name}
                      style={{
                        background: "#fff",
                        border: UI.border,
                        borderRadius: UI.radius,
                        padding: 12,
                        boxShadow: UI.shadow,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div style={{ fontSize: 12, fontWeight: 950, color: UI.text }}>{k.name}</div>
                        <div style={{ fontSize: 16, fontWeight: 950, color: UI.text }}>{formatNumber(k.cur)}</div>
                      </div>
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: UI.subText }}>
                        <span>전월 {formatNumber(k.prev)}</span>
                        <span style={{ fontWeight: 950, color: UI.text }}>
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

              {/* Drivers + Drilldown */}
              <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 10 }}>
                {/* Left: drivers */}
                <Card
                  title={`${activeKpi} 변화 요인 (Driver)`}
                  right={driver ? <Chip tone="neutral">KPI Δ {formatSignedNumber(safeNum(driver.kpi_diff))}</Chip> : null}
                >
                  {!driver ? (
                    <div style={{ fontSize: 12, color: UI.subText }}>드라이버 없음</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {driver.components.map((c) => {
                        const isActive = activeComponent === c.component;
                        const prev = safeNum(c.prev);
                        const diff = safeNum(c.diff);
                        const rate = prev ? (diff / prev) * 100 : diff ? 100 : 0;

                        const contribTone = chipToneBySignedValue(c.contrib);

                        return (
                          <div
                            key={c.component}
                            onClick={() => {
                              setAutoTrace(null);
                              setActiveComponent(c.component);
                              setDrillStack([{ key: joinPath([c.component]), label: c.component, parts: [c.component] }]);
                              setShowAllChildren(false);
                              setChildFilter("");
                              setSortMode("absdiff");
                            }}
                            style={{
                              padding: 12,
                              borderRadius: UI.radius,
                              border: isActive ? "1px solid #111827" : UI.border,
                              background: "#fff",
                              cursor: "pointer",
                              boxShadow: isActive ? "0 2px 8px rgba(15,23,42,0.12)" : UI.shadow,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                              <div style={{ fontSize: 12, fontWeight: 950, minWidth: 0, color: UI.text }}>
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.component}</span>
                                <span style={{ marginLeft: 8, fontSize: 11, color: UI.subText }}>(기여 {formatSignedNumber(safeNum(c.contrib))})</span>
                              </div>
                              <Chip tone={contribTone}>{formatSignedNumber(safeNum(c.contrib))}</Chip>
                            </div>

                            <div style={{ marginTop: 8 }}>
                              <Bar value={safeNum(c.contrib)} maxAbs={driverMaxAbs} height={10} />
                            </div>

                            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: UI.subText }}>
                              <span>
                                {formatNumber(prev)} → {formatNumber(safeNum(c.cur))}
                              </span>
                              <span style={{ fontWeight: 950, color: UI.text }}>
                                {formatSignedNumber(diff)} ({formatRate(rate)})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* Right: drilldown */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Card
                    title={drillStack.length ? `드릴다운 — ${drillStack[drillStack.length - 1].label}` : "드릴다운 (세부 원인)"}
                    right={
                      drillStack.length ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                          {(() => {
                            const lastLabel = drillStack[drillStack.length - 1].label;
                            const hasBackend = !!(backendDrilldowns?.[lastLabel]?.length);
                            const hasPath = flatItems.length > 0;
                            const srcTone = chipToneForSource(hasBackend, hasPath);
                            const srcText = hasBackend ? "backend" : hasPath ? "path" : "-";

                            return (
                              <Chip tone={srcTone}>
                                source: {srcText}
                              </Chip>
                            );
                          })()}

                          <Button
                            tone="ghost"
                            disabled={drillStack.length <= 1}
                            onClick={() => {
                              setAutoTrace(null);
                              setDrillStack(drillStack.slice(0, -1));
                              setShowAllChildren(false);
                              setChildFilter("");
                              setSortMode("absdiff");
                            }}
                          >
                            ◀
                          </Button>

                          <Button tone="outline" disabled={!drillStack.length} onClick={runAutoTrace}>
                            Auto Trace
                          </Button>
                        </div>
                      ) : (
                        <Chip tone="neutral">좌측 Driver 클릭</Chip>
                      )
                    }
                  >
                    {!drillStack.length ? (
                      <div style={{ fontSize: 12, color: UI.subText, lineHeight: 1.6 }}>Driver를 클릭하면 하위 항목이 뜹니다.</div>
                    ) : rawCurrentDrillList.length === 0 ? (
                      <div style={{ fontSize: 12, color: UI.subText, lineHeight: 1.6 }}>
                        이 레벨에서 하위 데이터가 없습니다(leaf 또는 누락). 아래 Missing을 확인하세요.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {/* ✅ Breadcrumb (단계 점프) */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {drillStack.map((d, idx) => (
                            <Button
                              key={d.key}
                              tone={idx === drillStack.length - 1 ? "solid" : "ghost"}
                              onClick={() => jumpToLevel(idx)}
                              style={{ padding: "7px 10px", fontSize: 11 }}
                              title="해당 단계로 이동"
                            >
                              {idx === 0 ? d.label : `› ${d.label}`}
                            </Button>
                          ))}
                        </div>

                        {/* Parent 요약 */}
                        {parentSummary && (
                          <div style={{ border: UI.border, borderRadius: UI.radius, background: "#fff", padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                              <div style={{ fontWeight: 950, color: UI.text }}>Parent 요약</div>
                              <Chip tone={safeNum(parentSummary.diff) >= 0 ? "red" : "green"}>
                                {formatSignedNumber(parentSummary.diff)} ({formatRate(parentSummary.rate)})
                              </Chip>
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12, color: UI.subText, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <span>전월 {formatNumber(parentSummary.prev)}</span>
                              <span>→</span>
                              <span>당월 {formatNumber(parentSummary.cur)}</span>
                              <span style={{ color: "#9CA3AF" }}>|</span>
                              <span style={{ fontWeight: 900, color: UI.text }}>Impact로 “누가 움직였는지” 확정</span>
                            </div>
                          </div>
                        )}

                        {/* AutoTrace 결과 */}
                        {autoTrace && autoTrace.length > 1 && (
                          <div style={{ border: "1px dashed #CBD5E1", borderRadius: UI.radius, background: UI.bgSoft, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                              <div style={{ fontWeight: 950, color: UI.text }}>원인 트리 (자동 경로)</div>
                              <Chip tone="blue">leaf</Chip>
                            </div>
                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                              {autoTrace.map((t, idx) => {
                                const v = t.value;
                                return (
                                  <div key={joinPath(t.parts)} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                    <span style={{ color: UI.text }}>
                                      {idx === 0 ? "Start" : `L${idx}`} : <b>{t.label}</b>
                                    </span>
                                    <span style={{ fontWeight: 950, color: "#1D4ED8" }}>
                                      {v ? `${formatSignedNumber(safeNum(v.diff))} (${formatRate(safeNum(v.rate))})` : ""}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* controls */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <Button tone={showAllChildren ? "ghost" : "solid"} onClick={() => setShowAllChildren(false)}>
                            TOP 8
                          </Button>
                          <Button tone={showAllChildren ? "solid" : "ghost"} onClick={() => setShowAllChildren(true)}>
                            전체
                          </Button>

                          <input
                            value={childFilter}
                            onChange={(e) => setChildFilter(e.target.value)}
                            placeholder="항목 검색"
                            style={{
                              flex: 1,
                              minWidth: 200,
                              padding: "9px 10px",
                              borderRadius: UI.radius,
                              border: UI.border,
                              outline: "none",
                              fontWeight: 700,
                              fontSize: 12,
                              background: "#fff",
                            }}
                          />

                          <select
                            value={sortMode}
                            onChange={(e) => setSortMode(e.target.value)}
                            style={{
                              padding: "9px 10px",
                              borderRadius: UI.radius,
                              border: UI.border,
                              fontWeight: 900,
                              fontSize: 12,
                              background: "#fff",
                              color: UI.text,
                            }}
                          >
                            <option value="absdiff">증감액</option>
                            <option value="impact">Impact</option>
                            <option value="rate">증감률</option>
                          </select>
                        </div>

                        {/* Drill list */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {currentDrillList.map((x) => {
                            const nextParts = [...(currentDrill?.parts || []), x.name];
                            const hasNext = getHasNext(nextParts);

                            const impact = safeNum(x.impact);
                            const signTone = chipToneBySignedValue(x.diff);
                            const impactTone = chipToneForImpact(impact);

                            return (
                              <div
                                key={joinPath(nextParts)}
                                onClick={() => {
                                  if (!hasNext) return;
                                  setAutoTrace(null);
                                  setDrillStack([...drillStack, { key: joinPath(nextParts), label: x.name, parts: nextParts }]);
                                  setShowAllChildren(false);
                                  setChildFilter("");
                                  setSortMode("absdiff");
                                }}
                                style={{
                                  padding: 12,
                                  borderRadius: UI.radius,
                                  border: UI.border,
                                  background: "#fff",
                                  cursor: hasNext ? "pointer" : "default",
                                  boxShadow: UI.shadow,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 950,
                                        color: UI.text,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {x.name}
                                    </div>
                                    {hasNext ? <Chip tone="dark">drill</Chip> : <Chip tone="neutral">leaf</Chip>}
                                  </div>

                                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                    <Chip tone={impactTone} title="Parent 변화(증감액) 중 이 항목 비중">
                                      Impact {formatRate(impact)}
                                    </Chip>
                                    <Chip tone={signTone}>
                                      {formatSignedNumber(safeNum(x.diff))} ({formatRate(safeNum(x.rate))})
                                    </Chip>
                                  </div>
                                </div>

                                <div style={{ marginTop: 8 }}>
                                  <Bar value={safeNum(x.diff)} maxAbs={drillMaxAbs} height={10} />
                                </div>

                                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11, color: UI.subText }}>
                                  <div style={{ border: UI.border, borderRadius: UI.radiusSm, padding: "8px 10px", background: UI.bgSoft }}>
                                    <div style={{ fontWeight: 900, color: UI.text }}>전월</div>
                                    <div style={{ marginTop: 4 }}>{formatNumber(safeNum(x.prev))}</div>
                                  </div>
                                  <div style={{ border: UI.border, borderRadius: UI.radiusSm, padding: "8px 10px", background: UI.bgSoft }}>
                                    <div style={{ fontWeight: 900, color: UI.text }}>당월</div>
                                    <div style={{ marginTop: 4 }}>{formatNumber(safeNum(x.cur))}</div>
                                  </div>
                                  <div style={{ border: UI.border, borderRadius: UI.radiusSm, padding: "8px 10px", background: UI.bgSoft }}>
                                    <div style={{ fontWeight: 900, color: UI.text }}>해석</div>
                                    <div style={{ marginTop: 4, fontWeight: 900, color: UI.text }}>
                                      {safeNum(x.diff) >= 0
                                        ? `Rate ${formatRate(safeNum(x.rate))} ↑ / Impact ${formatRate(impact)}`
                                        : `Rate ${formatRate(safeNum(x.rate))} ↓ / Impact ${formatRate(impact)}`}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {missingChildren.length > 0 && (
                          <div style={{ padding: 12, borderRadius: UI.radius, border: "1px solid #FDE68A", background: "#FFFBEB" }}>
                            <div style={{ fontWeight: 950, color: "#92400E", marginBottom: 8 }}>누락 가능(마감/매핑/데이터 미반영 의심)</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {missingChildren.slice(0, 20).map((n) => (
                                <Chip key={n} tone="amber">
                                  {n}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>

                  {/* 조건별 */}
                  <Card title="조건별 CEO 뷰 (차종/손익센터/유통경로 등)" right={<Chip tone="neutral">auto</Chip>}>
                    {conditionBlocks.length === 0 ? (
                      <div style={{ fontSize: 12, color: UI.subText, lineHeight: 1.6 }}>
                        현재 API 응답에 <b>조건별 분해 데이터</b>가 없습니다. (백엔드에서 by_condition 구조로 내려주면 자동 표시됩니다.)
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {conditionBlocks.map((blk) => (
                          <div key={blk.condKey} style={{ border: UI.border, borderRadius: UI.radius, padding: 12, background: "#fff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                              <div style={{ fontWeight: 950, color: UI.text }}>{blk.condKey}</div>
                              <Chip tone="blue">{blk.entries.length}개</Chip>
                            </div>

                            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                              {blk.entries.map(({ name, payload }) => {
                                const kpiCards2 = payload?.kpi_cards || [];
                                const drivers2 = payload?.drivers || {};
                                const d2 = drivers2?.[activeKpi] || null;
                                const curKpi = kpiCards2.find((x) => x.name === activeKpi) || null;

                                const topDriver =
                                  d2?.components?.slice().sort((a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib)))[0] || null;

                                return (
                                  <div key={name} style={{ border: UI.border, borderRadius: UI.radius, padding: 12, background: UI.bgSoft }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                                      <div
                                        style={{
                                          fontWeight: 950,
                                          minWidth: 0,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          color: UI.text,
                                        }}
                                      >
                                        {name}
                                      </div>
                                      {curKpi ? (
                                        <Chip tone={safeNum(curKpi.diff) >= 0 ? "red" : "green"}>
                                          {formatSignedNumber(safeNum(curKpi.diff))} ({formatRate(safeNum(curKpi.rate))})
                                        </Chip>
                                      ) : (
                                        <Chip tone="amber">no kpi</Chip>
                                      )}
                                    </div>

                                    <div style={{ marginTop: 10, fontSize: 12, color: UI.text, lineHeight: 1.6 }}>
                                      {topDriver ? (
                                        <>
                                          이 조건에서 <b>{activeKpi}</b> 핵심은 <b>{topDriver.component}</b>, 기여{" "}
                                          <b>{formatSignedNumber(safeNum(topDriver.contrib))}</b>
                                        </>
                                      ) : (
                                        <>Driver 정보가 없습니다. (조건별 drivers 필요)</>
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

              {/* 참고 */}
              <Card title="참고 — 전체 항목 중 전월 대비 변동 Top" tone="soft">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(causeData.top_items || []).slice(0, 10).map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 12,
                        padding: "8px 10px",
                        borderRadius: UI.radius,
                        border: UI.border,
                        background: "#fff",
                      }}
                    >
                      <span style={{ color: UI.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.path}</span>
                      <span style={{ fontWeight: 950, color: UI.text }}>
                        {formatSignedNumber(safeNum(t.diff))} ({formatRate(safeNum(t.rate))})
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
