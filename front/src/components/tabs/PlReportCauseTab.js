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
  영업외손익: ["영업외수익", "영업외비용"],
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

  // + : red/orange, - : green
  if (n >= 0) {
    if (t > 0.75) return "#DC2626";
    if (t > 0.45) return "#EA580C";
    return "#FDBA74";
  } else {
    if (t > 0.75) return "#047857";
    if (t > 0.45) return "#16A34A";
    return "#86EFAC";
  }
}

/* =========================
 * ✅ UI (스크린샷 느낌: 깔끔한 카드)
 * ========================= */
const UI = {
  radius: 6,
  radiusSm: 4,
  border: "1px solid #E5E7EB",
  bgPage: "#F3F4F6",
  bg: "#FFFFFF",
  bgSoft: "#F9FAFB",
  text: "#111827",
  subText: "#6B7280",
  line: "#E5E7EB",
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
  };

  const style =
    tone === "outline"
      ? { ...base, background: "#fff", color: UI.text, border: "1px solid #D1D5DB" }
      : tone === "ghost"
      ? { ...base, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }
      : { ...base, background: "#111827", color: "#fff", border: "1px solid #111827" };

  return (
    <button type="button" title={title || ""} onClick={disabled ? undefined : onClick} style={{ ...style, ...(styleProp || {}) }}>
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

function Card({ title, right, children, tone = "default", style }) {
  const bg = tone === "soft" ? UI.bgSoft : tone === "page" ? UI.bgPage : UI.bg;

  return (
    <div
      style={{
        background: bg,
        border: UI.border,
        borderRadius: UI.radius,
        padding: 14,
        ...(style || {}),
      }}
    >
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

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 950, color: "#9CA3AF", letterSpacing: 0.3, marginBottom: 8 }}>
      {String(children).toUpperCase()}
    </div>
  );
}

/* =========================
 * ✅ 결산 한눈에 보기 (당월/전월 박스가 보이게)
 * ========================= */
function GlanceKpiCard({ label, cur, prev, diff, rate, accent = "#2563EB" }) {
  const tone = safeNum(diff) >= 0 ? "red" : "green";
  return (
    <div style={{ background: "#fff", border: UI.border, borderRadius: UI.radius, padding: 12, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 950, color: UI.subText }}>{label}</div>
          <Chip tone={tone}>
            Δ {formatSignedNumber(diff)} ({formatRate(rate)})
          </Chip>
        </div>

        <div style={{ marginTop: 8, fontSize: 20, fontWeight: 950, color: UI.text, lineHeight: 1.1 }}>
          {formatNumber(cur)}
        </div>

        {/* ✅ 당월/전월이 "박스"로 보이게 */}
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ border: UI.border, borderRadius: UI.radiusSm, padding: "8px 10px", background: UI.bgSoft }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: UI.subText }}>전월</div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 950, color: UI.text }}>{formatNumber(prev)}</div>
          </div>
          <div style={{ border: UI.border, borderRadius: UI.radiusSm, padding: "8px 10px", background: UI.bgSoft }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: UI.subText }}>당월</div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 950, color: UI.text }}>{formatNumber(cur)}</div>
          </div>
        </div>
      </div>
    </div>
  );
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
 * ✅ 전월 대비 핵심 스트립
 * ========================= */
function MetricCompareStrip({ metrics = [] }) {
  return (
    <Card tone="default" title="전월 대비 핵심 지표" right={<Chip tone="blue">당월 / 전월 / Δ / 증감률</Chip>}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, metrics.length)}, minmax(0, 1fr))`, gap: 10 }}>
        {metrics.map((m) => {
          const signTone = safeNum(m.diff) >= 0 ? "red" : "green";
          return (
            <div key={m.key} style={{ border: UI.border, borderRadius: UI.radius, background: "#fff", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 950, color: UI.text }}>{m.label}</div>
                <Chip tone={signTone}>
                  Δ {formatSignedNumber(safeNum(m.diff))} ({formatRate(safeNum(m.rate))})
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
 * ✅ Summary sentence generator (영업이익 강화)
 * ========================= */
function buildSummarySentenceAdvanced({ activeKpi, viewData, driver, getChildren, getHasNext }) {
  const kpiCards = viewData?.kpi_cards || [];
  const map = new Map();
  kpiCards.forEach((x) => map.set(String(x.name), x));

  const k = map.get(activeKpi);
  const kpiDiff = safeNum(k?.diff);
  const kpiDir = kpiDiff >= 0 ? "증가" : "감소";

  const topDriver =
    driver?.components?.slice()?.sort((a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib)))[0] || null;

  const traceLeaf = (rootName) => {
    if (!rootName) return null;
    const trace = autoTracePath({ getChildren, getHasNext, startParts: [rootName], maxDepth: 12 });
    if (!trace || trace.length <= 1) return null;
    const leaf = trace[trace.length - 1];
    return { trace, leaf };
  };

  if (activeKpi === "영업이익") {
    const sales = map.get("매출액");
    const cogs = map.get("매출원가계");
    const sga = map.get("판매비와일반관리비");

    const salesDiff = safeNum(sales?.diff);
    const cogsDiff = safeNum(cogs?.diff);
    const sgaDiff = safeNum(sga?.diff);

    const salesHelp = salesDiff > 0;
    const cogsHelp = cogsDiff < 0;
    const sgaHelp = sgaDiff < 0;

    const salesLeaf = salesHelp ? traceLeaf("매출액") : null;
    const sgaLeaf = sgaHelp ? traceLeaf("판매비와일반관리비") : null;
    const cogsLeaf = cogsHelp ? traceLeaf("매출원가계") : null;

    const lines = [];
    lines.push(`결론: **영업이익이 ${kpiDir}**했습니다 (Δ ${formatSignedNumber(kpiDiff)}).`);

    if (topDriver) {
      lines.push(`주요 Driver: **${topDriver.component}** (기여 ${formatSignedNumber(safeNum(topDriver.contrib))}).`);
    }

    if (salesHelp && salesLeaf?.leaf?.value) {
      const v = salesLeaf.leaf.value;
      lines.push(`매출 상세: **${salesLeaf.leaf.label}** 변동이 큼 (Δ ${formatSignedNumber(safeNum(v.diff))}, ${formatRate(safeNum(v.rate))}).`);
    } else if (salesDiff !== 0) {
      lines.push(`매출액 Δ ${formatSignedNumber(salesDiff)}.`);
    }

    if (sgaHelp && sgaLeaf?.leaf?.value) {
      const v = sgaLeaf.leaf.value;
      lines.push(`판관비 상세: **${sgaLeaf.leaf.label}** 영향 (Δ ${formatSignedNumber(safeNum(v.diff))}, ${formatRate(safeNum(v.rate))}).`);
    } else if (sgaDiff !== 0) {
      lines.push(`판관비 Δ ${formatSignedNumber(sgaDiff)}.`);
    }

    if (cogsHelp && cogsLeaf?.leaf?.value) {
      const v = cogsLeaf.leaf.value;
      lines.push(`원가 상세: **${cogsLeaf.leaf.label}** 영향 (Δ ${formatSignedNumber(safeNum(v.diff))}, ${formatRate(safeNum(v.rate))}).`);
    }

    return lines.join(" ");
  }

  if (k) {
    const drv = topDriver
      ? `주요 원인: **${topDriver.component}** (기여 ${formatSignedNumber(safeNum(topDriver.contrib))}).`
      : `주요 원인(Driver) 데이터 부족.`;
    return `결론: **${activeKpi}이(가) ${kpiDir}**했습니다 (Δ ${formatSignedNumber(kpiDiff)}). ${drv}`;
  }

  return `${activeKpi} KPI 정보가 없습니다.`;
}

/* =========================
 * ✅ Non-operating split helpers
 * ========================= */
function aggregateRootTotals(flatItems, rootName) {
  if (!flatItems?.length) return null;
  let cur = 0;
  let prev = 0;
  let diff = 0;
  let hit = 0;

  for (const it of flatItems) {
    if (!it?.path) continue;
    const parts = splitPath(it.path);
    if (!parts.length) continue;
    if (parts[0] !== rootName) continue;

    cur += safeNum(it.cur);
    prev += safeNum(it.prev);
    diff += safeNum(it.diff);
    hit += 1;
  }

  if (!hit) return null;
  const rate = prev ? (diff / prev) * 100 : diff ? 100 : 0;
  return { name: rootName, cur, prev, diff, rate, _cnt: hit };
}

/* =========================
 * ✅ Top10 (세부항목만 + 출처 prefix 표시 + "비율" 기준 정렬)
 * ========================= */
function buildDetailTop10ByRate(list, { excludeRoots = [], limit = 10 }) {
  const out = [];
  for (const raw of list || []) {
    const path = raw?.path ? String(raw.path) : "";
    const parts = splitPath(path);
    if (!parts.length) continue;

    // ✅ 최상위(루트) 제외: depth 1 제외 + root blacklist 제외
    const root = parts[0];
    if (parts.length <= 1) continue;
    if (excludeRoots.includes(root)) continue;

    const leaf = parts[parts.length - 1];
    const prefixParts = parts.slice(0, -1);

    // 표시용 prefix는 "어디에서 나온 세부항목인지"가 보이도록 (가능하면 2레벨)
    const prefix =
      prefixParts.length >= 2
        ? `${prefixParts[0]} > ${prefixParts[1]}`
        : prefixParts.length === 1
        ? `${prefixParts[0]}`
        : "-";

    const diff = safeNum(raw?.diff);
    const rate = safeNum(raw?.rate);

    out.push({ path, root, leaf, prefix, diff, rate });
  }

  // ✅ "비율" 기준(절대값)으로 Top10
  out.sort((a, b) => {
    const ar = Math.abs(safeNum(a.rate));
    const br = Math.abs(safeNum(b.rate));
    if (br !== ar) return br - ar;
    return Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff));
  });

  return out.slice(0, limit);
}

function Top10Card({ title, items }) {
  return (
    <Card title={title} tone="default" right={<Chip tone="blue">TOP 10</Chip>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(items || []).map((t, idx) => (
          <div
            key={`${t.path}-${idx}`}
            style={{
              background: "#fff",
              border: UI.border,
              borderRadius: UI.radius,
              padding: "10px 10px",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              alignItems: "center",
            }}
            title={t.path}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <Chip tone="neutral" title="세부항목 출처(상위 경로)">{t.prefix}</Chip>
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
                  {t.leaf}
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <Bar value={safeNum(t.rate)} maxAbs={Math.max(1, Math.abs(safeNum(t.rate)))} height={8} />
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 950, color: UI.text }}>{formatRate(safeNum(t.rate))}</div>
              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 900, color: "#6B7280" }}>
                Δ {formatSignedNumber(safeNum(t.diff))}
              </div>
            </div>
          </div>
        ))}

        {(!items || items.length === 0) && (
          <div style={{ fontSize: 12, color: UI.subText, lineHeight: 1.6 }}>
            세부항목 Top10이 없습니다. (top_items가 1레벨만 있거나 제외 규칙으로 필터링되었을 수 있습니다)
          </div>
        )}
      </div>
    </Card>
  );
}

/* =========================
 * Main
 * ========================= */
export default function PlReportCauseTab() {
  const [periods, setPeriods] = useState([]);
  const [selectedYm, setSelectedYm] = useState(null); // "YYYY-MM"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [causeData, setCauseData] = useState(null);

  const [activeKpi, setActiveKpi] = useState("영업이익");
  const [drillStack, setDrillStack] = useState([]);
  const [activeComponent, setActiveComponent] = useState(null);
  const [autoTrace, setAutoTrace] = useState(null);

  const [showAllChildren, setShowAllChildren] = useState(false);
  const [childFilter, setChildFilter] = useState("");
  const [sortMode, setSortMode] = useState("absdiff");

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
          const ym = `${last.year}-${String(last.month).padStart(2, "0")}`;
          setSelectedYm(ym);
        }
      } catch (err) {
        setError(err.message || "원인 분석 기간 목록 조회 오류");
      }
    };
    fetchPeriods();
  }, []);

  // ymOptions
  const ymOptions = useMemo(() => {
    const list = (periods || []).map((p) => ({
      ym: `${p.year}-${String(p.month).padStart(2, "0")}`,
      year: p.year,
      month: p.month,
    }));
    const seen = new Set();
    const out = [];
    for (const x of list) {
      if (seen.has(x.ym)) continue;
      seen.add(x.ym);
      out.push(x);
    }
    out.sort((a, b) => (a.ym > b.ym ? 1 : a.ym < b.ym ? -1 : 0));
    return out;
  }, [periods]);

  /* cause fetch */
  useEffect(() => {
    if (!selectedYm) return;

    const [yStr, mStr] = String(selectedYm).split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return;

    const fetchCause = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ year: String(y), month: String(m) }).toString();
        const res = await fetch(`/api/pl-cause?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setCauseData(data);

        // ✅ 화면 상태 리셋
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
  }, [selectedYm]);

  // ✅ 조건 선택 UI 제거 → 항상 전체 데이터 사용
  const viewData = causeData;

  // viewData 기반
  const kpiCards = viewData?.kpi_cards || [];
  const drivers = viewData?.drivers || {};
  const driver = drivers?.[activeKpi] || null;

  const backendDrilldowns = viewData?.drilldowns || {};
  const flatItems = useMemo(() => {
    const src = viewData?.all_items || viewData?.items || viewData?.top_items || [];
    return (src || []).map(normalizeItem).filter((x) => x.path && x.path.length > 0);
  }, [viewData]);

  const driverMaxAbs = useMemo(() => {
    if (!driver?.components?.length) return 0;
    return Math.max(...driver.components.map((c) => Math.abs(safeNum(c.contrib))));
  }, [driver]);

  const currentDrill = drillStack.length ? drillStack[drillStack.length - 1] : null;

  // ✅ children getter (backend 우선, 없으면 path 기반)
  const getChildren = useMemo(() => {
    return (prefixParts) => {
      const keyName = prefixParts[prefixParts.length - 1];

      // ✅ "영업외손익" 아래는 "영업외수익/영업외비용"로 바로 분기
      if (keyName === "영업외손익") {
        const backendList = backendDrilldowns?.[keyName];
        if (Array.isArray(backendList) && backendList.length > 0) {
          const names = backendList.map((x) => String(x.name));
          const hasSplit = names.includes("영업외수익") || names.includes("영업외비용");
          if (hasSplit) {
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
        }

        const a = aggregateRootTotals(flatItems, "영업외수익");
        const b = aggregateRootTotals(flatItems, "영업외비용");

        const out = [];
        if (a) out.push(a);
        if (b) out.push(b);

        if (!out.length) {
          return ["영업외수익", "영업외비용"].map((name) => ({
            name,
            cur: 0,
            prev: 0,
            diff: 0,
            rate: 0,
          }));
        }

        out.sort((x, y) => Math.abs(safeNum(y.diff)) - Math.abs(safeNum(x.diff)));
        return out;
      }

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
      if (last === "영업외손익") return true;
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
    if (!driver?.components?.length) {
      setAutoTrace(null);
      setActiveComponent(null);
      setDrillStack([]);
      return;
    }
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
      return Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff));
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

  const showFatal = !periods.length && !!error;

  const kpiTabs = ["매출총이익", "영업이익", "당기순이익"];
  const topKpiNames = ["매출액", "매출총이익", "영업이익", "당기순이익", "매출원가계", "판매비와일반관리비"];
  const excludeTop10Roots = [...topKpiNames, "영업외손익", "영업외수익", "영업외비용"];

  const dataDepth = viewData?.all_items || viewData?.items ? "DEEP" : "SHALLOW";
  const depthTone = dataDepth === "DEEP" ? "green" : "amber";

  // KPI map
  const kpiMap = useMemo(() => {
    const map = new Map();
    (kpiCards || []).forEach((k) => map.set(String(k.name), k));
    return map;
  }, [kpiCards]);

  const pickKpi = (name) => {
    const k = kpiMap.get(name);
    const cur = safeNum(k?.cur);
    const prev = safeNum(k?.prev);
    const diff = safeNum(k?.diff ?? (cur - prev));
    const rate =
      typeof k?.rate !== "undefined" && k?.rate !== null ? safeNum(k.rate) : prev ? (diff / prev) * 100 : diff ? 100 : 0;
    return { name, cur, prev, diff, rate };
  };

  const topCompareMetrics = useMemo(() => {
    return [
      { key: "영업이익", label: "영업이익", ...pickKpi("영업이익") },
      { key: "판매비와일반관리비", label: "판관비(영업비용)", ...pickKpi("판매비와일반관리비") },
      { key: "매출원가계", label: "매출원가", ...pickKpi("매출원가계") },
      { key: "매출액", label: "매출액", ...pickKpi("매출액") },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiMap]);

  // “비용 중심” 바로가기
  const focusOnOpex = () => {
    setActiveKpi("영업이익");
    setAutoTrace(null);
    setActiveComponent("판매비와일반관리비");
    setDrillStack([{ key: joinPath(["판매비와일반관리비"]), label: "판매비와일반관리비", parts: ["판매비와일반관리비"] }]);
    setShowAllChildren(false);
    setChildFilter("");
    setSortMode("absdiff");
  };

  // Breadcrumb 점프
  const jumpToLevel = (idx) => {
    if (idx < 0) return;
    setAutoTrace(null);
    setDrillStack(drillStack.slice(0, idx + 1));
    setShowAllChildren(false);
    setChildFilter("");
    setSortMode("absdiff");
  };

  // ✅ “전월 대비 손익 변동 요약” 문장 (너가 말한 그 문장 유지 + AI 요약 영역에 표시)
  const summarySentence = useMemo(() => {
    if (!viewData) return "";
    return buildSummarySentenceAdvanced({ activeKpi, viewData, driver, getChildren, getHasNext });
  }, [activeKpi, viewData, driver, getChildren, getHasNext]);

  const activeKpiCard = useMemo(() => {
    const k = kpiMap.get(activeKpi);
    if (!k) return { cur: 0, prev: 0, diff: 0, rate: 0 };
    const cur = safeNum(k?.cur);
    const prev = safeNum(k?.prev);
    const diff = safeNum(k?.diff ?? (cur - prev));
    const rate = typeof k?.rate !== "undefined" && k?.rate !== null ? safeNum(k.rate) : prev ? (diff / prev) * 100 : diff ? 100 : 0;
    return { cur, prev, diff, rate };
  }, [kpiMap, activeKpi]);

  // ✅ 오른쪽 아래 Top10: "전체 증감 비율" 기준으로 추림 (세부항목만 + 출처 prefix)
  const top10ByRate = useMemo(() => {
    const src = viewData?.top_items || [];
    return buildDetailTop10ByRate(src, { excludeRoots: excludeTop10Roots, limit: 10 });
  }, [viewData, excludeTop10Roots]);

  // ✅ 결산 한눈에 보기: (매출액/매출총이익/영업이익/당기순이익) + 당월/전월 박스 표시
  const glanceKpis = useMemo(() => {
    const a = pickKpi("매출액");
    const b = pickKpi("매출총이익");
    const c = pickKpi("영업이익");
    const d = pickKpi("당기순이익");
    return [
      { ...a, label: "매출액", accent: "#2563EB" },
      { ...b, label: "매출총이익", accent: "#7C3AED" },
      { ...c, label: "영업이익", accent: "#DC2626" },
      { ...d, label: "당기순이익", accent: "#059669" },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiMap]);

  return (
    <div style={{ width: "100%", background: UI.bgPage, padding: 12 }}>
      {/* ===== 상단 헤더 라인 (Month 선택: 기존 select 그대로) ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 950, color: UI.text }}>결산 요약 / 원인 분석</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Chip tone={depthTone} title="items/all_items가 있으면 leaf까지 드릴다운이 깊어집니다.">
            depth: {dataDepth}
          </Chip>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 950, color: UI.subText }}>Month</span>
            <select
              value={selectedYm || ""}
              onChange={(e) => setSelectedYm(e.target.value)}
              disabled={!ymOptions.length}
              style={{
                padding: "9px 10px",
                borderRadius: UI.radius,
                border: UI.border,
                fontWeight: 950,
                fontSize: 12,
                background: "#fff",
                color: UI.text,
                minWidth: 130,
              }}
            >
              {ymOptions.map((o) => (
                <option key={o.ym} value={o.ym}>
                  {o.ym}
                </option>
              ))}
            </select>
          </div>

          <Button tone="outline" onClick={focusOnOpex} title="판관비(영업비용)부터 바로 드릴다운">
            판관비 중심 분석
          </Button>
        </div>
      </div>

      {showFatal && <div style={{ color: "#ef4444", fontWeight: 900 }}>{error}</div>}

      {!showFatal && (
        <>
          {loading && <div style={{ fontSize: 12, color: UI.subText, marginBottom: 10 }}>불러오는 중...</div>}
          {error && !loading && <div style={{ color: "#ef4444", fontWeight: 900, marginBottom: 10 }}>{error}</div>}

          {!loading && !error && viewData && (
            <>
              {/* ===== 상단: 좌(결산 한눈에 보기) / 우(AI 결산 요약 + "전월 대비 손익 변동 요약" 문장) ===== */}
              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, marginBottom: 12 }}>
                <Card
                  title="결산 한눈에 보기"
                  right={
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {viewData?.current_period?.label ? <Chip tone="blue">분석월: {viewData.current_period.label}</Chip> : null}
                      {viewData?.previous_period?.label ? <Chip tone="neutral">전월: {viewData.previous_period.label}</Chip> : null}
                    </div>
                  }
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    {glanceKpis.map((k) => (
                      <GlanceKpiCard
                        key={k.label}
                        label={k.label}
                        cur={k.cur}
                        prev={k.prev}
                        diff={k.diff}
                        rate={k.rate}
                        accent={k.accent}
                      />
                    ))}
                  </div>
                </Card>

                <Card title="AI 결산 상태 요약">
                  <SectionLabel>SUMMARY</SectionLabel>

                  <div style={{ fontSize: 12, color: UI.text, lineHeight: 1.75 }}>
                    {/* ✅ 기존 SUMMARY(너가 원래 쓰던 오른쪽 설명) */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: "#111827", marginTop: 7 }} />
                      <div>
                        <b>Closing Check</b>: 이상·누락 의심 이슈를 빠르게 점검하고(마감 누락/비정상 패턴), 필요 시 Closing 탭에서 확인합니다.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: "#111827", marginTop: 7 }} />
                      <div>
                        <b>Variance</b>: 전월 대비 변동이 큰 계정/항목을 우선 확인하고, 세부 구조는 Variance/원인 분석에서 드릴다운합니다.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: "#111827", marginTop: 7 }} />
                      <div>
                        <b>P&amp;L Report</b>: 손익계산서 기준으로 계정별 실적과 기여도를 확인합니다.
                      </div>
                    </div>

                    {/* ✅ 네가 말한 “두번째 사진” 문장(전월 대비 손익 변동 요약) */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${UI.line}` }}>
                      <div style={{ fontSize: 12, fontWeight: 950, color: UI.text }}>전월 대비 손익 변동 요약</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: UI.subText, lineHeight: 1.7 }}>
                        {summarySentence}
                      </div>
                    </div>

                    {/* 현재 선택 KPI 표시 */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${UI.line}` }}>
                      <div style={{ fontSize: 11, color: UI.subText, fontWeight: 900 }}>현재 선택 KPI</div>
                      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 950, color: UI.text }}>{activeKpi}</div>
                        <Chip tone={safeNum(activeKpiCard.diff) >= 0 ? "red" : "green"}>
                          Δ {formatSignedNumber(activeKpiCard.diff)} ({formatRate(activeKpiCard.rate)})
                        </Chip>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <Bar value={activeKpiCard.diff} maxAbs={Math.max(1, Math.abs(activeKpiCard.diff)) || 1} height={10} />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* ===== 전월 대비 핵심 스트립 ===== */}
              <div style={{ marginBottom: 12 }}>
                <MetricCompareStrip metrics={topCompareMetrics} />
              </div>

              {/* ===== 본문: 좌(원인분석) + 우(오른쪽 아래 Top10) ===== */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 12, alignItems: "start" }}>
                {/* LEFT: 원인분석 영역 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Card title="원인 분석 KPI 선택" right={<Chip tone="neutral">클릭 시 Driver/DrillDown 자동 갱신</Chip>}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {kpiTabs.map((k) => (
                        <Button key={k} tone={activeKpi === k ? "solid" : "ghost"} onClick={() => setActiveKpi(k)}>
                          {k} 원인 분석
                        </Button>
                      ))}
                    </div>
                  </Card>

                  {/* Drivers + Drilldown (2열) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 12 }}>
                    {/* Drivers */}
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
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                                  <div style={{ fontSize: 12, fontWeight: 950, minWidth: 0, color: UI.text }}>
                                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.component}</span>
                                    <span style={{ marginLeft: 8, fontSize: 11, color: UI.subText }}>
                                      (기여 {formatSignedNumber(safeNum(c.contrib))})
                                    </span>
                                  </div>
                                  <Chip tone={toneForValue(c.contrib) === "pos" ? "red" : toneForValue(c.contrib) === "neg" ? "green" : "neutral"}>
                                    {formatSignedNumber(safeNum(c.contrib))}
                                  </Chip>
                                </div>

                                <div style={{ marginTop: 8 }}>
                                  <Bar value={safeNum(c.contrib)} maxAbs={driverMaxAbs} height={10} />
                                </div>

                                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: UI.subText }}>
                                  <span>
                                    {formatNumber(prev)} → {formatNumber(safeNum(c.cur))}
                                  </span>
                                  <span style={{ fontWeight: 950, color: UI.text }}>
                                    Δ {formatSignedNumber(diff)} ({formatRate(rate)})
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>

                    {/* Drilldown */}
                    <Card
                      title={drillStack.length ? `변동 원인 상세 (Drill-down) — ${drillStack[drillStack.length - 1].label}` : "변동 원인 상세 (Drill-down)"}
                      right={
                        drillStack.length ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                            <Chip
                              tone={
                                backendDrilldowns?.[drillStack[drillStack.length - 1].label]?.length
                                  ? "blue"
                                  : flatItems.length
                                  ? "green"
                                  : "amber"
                              }
                            >
                              source:{" "}
                              {backendDrilldowns?.[drillStack[drillStack.length - 1].label]?.length
                                ? "backend"
                                : flatItems.length
                                ? "path"
                                : "-"}
                            </Chip>

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
                          {/* Breadcrumb */}
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
                                  Δ {formatSignedNumber(parentSummary.diff)} ({formatRate(parentSummary.rate)})
                                </Chip>
                              </div>
                              <div style={{ marginTop: 8, fontSize: 12, color: UI.subText, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <span>전월 {formatNumber(parentSummary.prev)}</span>
                                <span>→</span>
                                <span>당월 {formatNumber(parentSummary.cur)}</span>
                                <span style={{ color: "#9CA3AF" }}>|</span>
                                <span style={{ fontWeight: 900, color: UI.text }}>Impact로 “누가 움직였는지” 확인</span>
                              </div>
                            </div>
                          )}

                          {/* AutoTrace */}
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
                                        {v ? `Δ ${formatSignedNumber(safeNum(v.diff))} (${formatRate(safeNum(v.rate))})` : ""}
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
                              const signTone =
                                toneForValue(x.diff) === "pos" ? "red" : toneForValue(x.diff) === "neg" ? "green" : "neutral";
                              const impactTone =
                                Math.abs(impact) >= 50 ? (impact >= 0 ? "red" : "green") : Math.abs(impact) >= 20 ? "blue" : "neutral";

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
                                        Δ {formatSignedNumber(safeNum(x.diff))} ({formatRate(safeNum(x.rate))})
                                      </Chip>
                                    </div>
                                  </div>

                                  <div style={{ marginTop: 8 }}>
                                    <Bar value={safeNum(x.diff)} maxAbs={drillMaxAbs} height={10} />
                                  </div>

                                  <div
                                    style={{
                                      marginTop: 8,
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr 1fr",
                                      gap: 8,
                                      fontSize: 11,
                                      color: UI.subText,
                                    }}
                                  >
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
                  </div>
                </div>

                {/* RIGHT: "세번째 사진처럼" 오른쪽 아래에 Top10 (비율 기준) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ height: 1 }} />
                  <Top10Card title="전체 증감 비율 Top 10 (세부항목)" items={top10ByRate} />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
