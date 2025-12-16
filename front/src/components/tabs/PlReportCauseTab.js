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
  const diff = safeNum(raw?.diff ?? cur - prev);
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
    if (!agg.has(childName))
      agg.set(childName, { cur: 0, prev: 0, diff: 0, n: 0 });
    const a = agg.get(childName);
    a.cur += safeNum(it.cur);
    a.prev += safeNum(it.prev);
    a.diff += safeNum(it.diff);
    a.n += 1;
  }

  const out = Array.from(agg.entries()).map(([childName, a]) => {
    const rate = a.prev ? (a.diff / a.prev) * 100 : a.diff ? 100 : 0;
    return {
      name: childName,
      cur: a.cur,
      prev: a.prev,
      diff: a.diff,
      rate,
      _cnt: a.n,
    };
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
  수출매출액: [
    "판매수량(수출)",
    "제품매출",
    "상품매출",
    "설비매출",
    "기타매출",
  ],
  매출원가계: ["국내매출원가", "수출매출원가"],
  국내매출원가: ["제품", "상품", "기타"],
  수출매출원가: ["제품", "상품", "기타"],
  판매비와일반관리비: [
    "급여",
    "퇴직급여",
    "복리후생비",
    "감가상각비",
    "지급수수료",
    "운반비",
    "광고선전비",
    "기타",
  ],
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
 * ✅ UI
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
      : {
          background: "#F3F4F6",
          color: "#374151",
          border: "1px solid #E5E7EB",
        };

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

function Button({
  children,
  onClick,
  disabled,
  tone = "solid",
  title,
  style: styleProp,
}) {
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
      ? {
          ...base,
          background: "#fff",
          color: UI.text,
          border: "1px solid #D1D5DB",
        }
      : tone === "ghost"
      ? {
          ...base,
          background: "#F3F4F6",
          color: "#374151",
          border: "1px solid #E5E7EB",
        }
      : {
          ...base,
          background: "#111827",
          color: "#fff",
          border: "1px solid #111827",
        };

  return (
    <button
      type="button"
      title={title || ""}
      onClick={disabled ? undefined : onClick}
      style={{ ...style, ...(styleProp || {}) }}
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
    <div
      style={{
        height,
        borderRadius: UI.radiusSm,
        background: "#EEF2F7",
        overflow: "hidden",
      }}
    >
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

function Card({ title, right, topSlot, children, tone = "default", style }) {
  const bg = tone === "soft" ? UI.bgSoft : tone === "page" ? UI.bgPage : UI.bg;

  return (
    <div
      style={{
        background: bg,
        border: UI.border,
        borderRadius: UI.radius,
        padding: 14,
        position: "relative",
        overflow: "visible",
        ...(style || {}),
      }}
    >
      {topSlot}
      {(title || right) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 950, color: UI.text }}>
            {title}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/* =========================
 * ✅ 한 줄 요약 스트립 (제목 없음 / 작은 높이)
 * ========================= */
function InlineMoMSummary({ text }) {
  if (!text) return null;

  return (
    <div
      style={{
        marginTop: 6,
        padding: "8px 12px",
        borderRadius: 6,
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12,
        lineHeight: 1.6,
        height: 40,
        boxSizing: "border-box",
      }}
      title={text}
    >
      <div
        style={{
          width: 3,
          height: 18,
          background: "#111827",
          borderRadius: 2,
          flexShrink: 0,
        }}
      />

      <div
        style={{
          color: "#374151",
          fontWeight: 900,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          minWidth: 0,
          flex: 1,
        }}
      >
        {text}
      </div>
    </div>
  );
}

/* =========================
 * Auto Trace
 * ========================= */
function autoTracePath({ getChildren, getHasNext, startParts, maxDepth = 10 }) {
  const trace = [
    {
      parts: startParts.slice(),
      label: startParts[startParts.length - 1],
      value: null,
    },
  ];
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
 * ✅ 전월 ↔ 당월 핵심 비교 (가로 4칸, 한눈에)
 * ========================= */
function MetricCompareStrip({ metrics = [] }) {
  const isGoodMove = (label, diff) => {
    const d = safeNum(diff);
    // 이익/매출 계열: 증가가 Good
    if (label.includes("이익") || label.includes("매출")) return d >= 0;
    // 비용 계열: 감소가 Good
    return d <= 0;
  };

  return (
    <div
      style={{
        border: UI.border,
        borderRadius: 14,
        background: "#fff",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 950, color: UI.text }}>
          전월 ↔ 당월 핵심 비교
        </div>
        <Chip tone="blue">전월 → 당월 · Δ · %</Chip>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        {metrics.map((m, idx) => {
          const prev = safeNum(m.prev);
          const cur = safeNum(m.cur);
          const diff = safeNum(m.diff ?? cur - prev);
          const rate =
            typeof m.rate !== "undefined" && m.rate !== null
              ? safeNum(m.rate)
              : prev
              ? (diff / prev) * 100
              : diff
              ? 100
              : 0;

          const good = isGoodMove(m.label, diff);
          const color = good ? "#16a34a" : "#dc2626";
          const arrow = diff === 0 ? "–" : diff > 0 ? "▲" : "▼";

          return (
            <div
              key={m.key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                paddingRight: idx !== metrics.length - 1 ? 12 : 0,
                borderRight:
                  idx !== metrics.length - 1 ? "1px dashed #e5e7eb" : "none",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: UI.subText,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {m.label}
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: UI.text,
                  lineHeight: "24px",
                }}
              >
                {formatNumber(cur)}
              </div>

              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                전월 {formatNumber(prev)}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 2,
                  fontSize: 12,
                  fontWeight: 900,
                  color,
                }}
              >
                <span>{arrow}</span>
                <span>{formatNumber(Math.abs(diff))}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6b7280",
                  }}
                >
                  ({formatRate(rate)})
                </span>
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  color: UI.subText,
                  fontWeight: 800,
                }}
              >
                {good ? "회사에 이득" : "회사에 손해"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
 * ✅ Summary sentence generator (영업이익 강화)
 * ========================= */
function buildSummarySentenceAdvanced({
  activeKpi,
  viewData,
  driver,
  getChildren,
  getHasNext,
}) {
  const kpiCards = viewData?.kpi_cards || [];
  const map = new Map();
  kpiCards.forEach((x) => map.set(String(x.name), x));

  const k = map.get(activeKpi);
  const kpiDiff = safeNum(k?.diff);
  const kpiDir = kpiDiff >= 0 ? "증가" : "감소";

  const topDriver =
    driver?.components
      ?.slice()
      ?.sort(
        (a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib))
      )[0] || null;

  const traceLeaf = (rootName) => {
    if (!rootName) return null;
    const trace = autoTracePath({
      getChildren,
      getHasNext,
      startParts: [rootName],
      maxDepth: 12,
    });
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
    lines.push(
      `결론: **영업이익이 ${kpiDir}**했습니다 (Δ ${formatSignedNumber(
        kpiDiff
      )}).`
    );

    if (topDriver) {
      lines.push(
        `주요 Driver: **${topDriver.component}** (기여 ${formatSignedNumber(
          safeNum(topDriver.contrib)
        )}).`
      );
    }

    if (salesHelp && salesLeaf?.leaf?.value) {
      const v = salesLeaf.leaf.value;
      lines.push(
        `매출 상세: **${
          salesLeaf.leaf.label
        }** 변동이 큼 (Δ ${formatSignedNumber(safeNum(v.diff))}, ${formatRate(
          safeNum(v.rate)
        )}).`
      );
    } else if (salesDiff !== 0) {
      lines.push(`매출액 Δ ${formatSignedNumber(salesDiff)}.`);
    }

    if (sgaHelp && sgaLeaf?.leaf?.value) {
      const v = sgaLeaf.leaf.value;
      lines.push(
        `판관비 상세: **${sgaLeaf.leaf.label}** 영향 (Δ ${formatSignedNumber(
          safeNum(v.diff)
        )}, ${formatRate(safeNum(v.rate))}).`
      );
    } else if (sgaDiff !== 0) {
      lines.push(`판관비 Δ ${formatSignedNumber(sgaDiff)}.`);
    }

    if (cogsHelp && cogsLeaf?.leaf?.value) {
      const v = cogsLeaf.leaf.value;
      lines.push(
        `원가 상세: **${cogsLeaf.leaf.label}** 영향 (Δ ${formatSignedNumber(
          safeNum(v.diff)
        )}, ${formatRate(safeNum(v.rate))}).`
      );
    }

    return lines.join(" ");
  }

  if (k) {
    const drv = topDriver
      ? `주요 원인: **${topDriver.component}** (기여 ${formatSignedNumber(
          safeNum(topDriver.contrib)
        )}).`
      : `주요 원인(Driver) 데이터 부족.`;
    return `결론: **${activeKpi}이(가) ${kpiDir}**했습니다 (Δ ${formatSignedNumber(
      kpiDiff
    )}). ${drv}`;
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

    const root = parts[0];
    if (parts.length <= 1) continue;
    if (excludeRoots.includes(root)) continue;

    const leaf = parts[parts.length - 1];
    const prefixParts = parts.slice(0, -1);

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
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <Chip tone="neutral" title="세부항목 출처(상위 경로)">
                  {t.prefix}
                </Chip>
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
                <Bar
                  value={safeNum(t.rate)}
                  maxAbs={Math.max(1, Math.abs(safeNum(t.rate)))}
                  height={8}
                />
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 950, color: UI.text }}>
                {formatRate(safeNum(t.rate))}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#6B7280",
                }}
              >
                Δ {formatSignedNumber(safeNum(t.diff))}
              </div>
            </div>
          </div>
        ))}

        {(!items || items.length === 0) && (
          <div style={{ fontSize: 12, color: UI.subText, lineHeight: 1.6 }}>
            세부항목 Top10이 없습니다. (top_items가 1레벨만 있거나 제외 규칙으로
            필터링되었을 수 있습니다)
          </div>
        )}
      </div>
    </Card>
  );
}

/* =========================
 * (기존) MoMSummaryBanner — 이제 사용 안 함 (남겨도 OK)
 * ========================= */
function MoMSummaryBanner({ text }) {
  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #E5E7EB",
        borderRadius: UI.radius,
        background: "#FFFFFF",
        padding: "10px 12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: "#111827",
        }}
      />

      <div style={{ paddingLeft: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              background: "#111827",
              color: "#fff",
              border: "1px solid #111827",
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: UI.radiusSm,
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
            title="월 대비 손익 변동 요약"
          >
            MoM 요약
          </span>

          <div
            style={{
              fontSize: 12,
              fontWeight: 950,
              color: UI.text,
              whiteSpace: "nowrap",
            }}
          >
            전월 대비 손익 변동
          </div>
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: UI.subText,
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          title={text || ""}
        >
          {text}
        </div>
      </div>
    </div>
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
        const params = new URLSearchParams({
          year: String(y),
          month: String(m),
        }).toString();
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
  }, [selectedYm]);

  const viewData = causeData;

  const kpiCards = viewData?.kpi_cards || [];
  const drivers = viewData?.drivers || {};
  const driver = drivers?.[activeKpi] || null;

  const backendDrilldowns = viewData?.drilldowns || {};
  const flatItems = useMemo(() => {
    const src =
      viewData?.all_items || viewData?.items || viewData?.top_items || [];
    return (src || [])
      .map(normalizeItem)
      .filter((x) => x.path && x.path.length > 0);
  }, [viewData]);

  const driverMaxAbs = useMemo(() => {
    if (!driver?.components?.length) return 0;
    return Math.max(
      ...driver.components.map((c) => Math.abs(safeNum(c.contrib)))
    );
  }, [driver]);

  const currentDrill = drillStack.length
    ? drillStack[drillStack.length - 1]
    : null;

  const getChildren = useMemo(() => {
    return (prefixParts) => {
      const keyName = prefixParts[prefixParts.length - 1];

      if (keyName === "영업외손익") {
        const backendList = backendDrilldowns?.[keyName];
        if (Array.isArray(backendList) && backendList.length > 0) {
          const names = backendList.map((x) => String(x.name));
          const hasSplit =
            names.includes("영업외수익") || names.includes("영업외비용");
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
              .sort(
                (a, b) => Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff))
              );
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

        out.sort(
          (x, y) => Math.abs(safeNum(y.diff)) - Math.abs(safeNum(x.diff))
        );
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
          .sort(
            (a, b) => Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff))
          );
      }

      if (!flatItems.length) return [];
      return buildChildrenFromPathItems(flatItems, prefixParts);
    };
  }, [backendDrilldowns, flatItems]);

  const getHasNext = useMemo(() => {
    return (parts) => {
      const last = parts[parts.length - 1];
      if (last === "영업외손익") return true;
      if (backendDrilldowns?.[last] && backendDrilldowns[last].length > 0)
        return true;
      if (!flatItems.length) return false;
      return hasDeeperLevel(flatItems, parts);
    };
  }, [backendDrilldowns, flatItems]);

  const rawCurrentDrillList = useMemo(() => {
    if (!currentDrill) return [];
    return getChildren(currentDrill.parts);
  }, [currentDrill, getChildren]);

  const parentSummary = useMemo(() => {
    if (!currentDrill) return null;
    if (!rawCurrentDrillList.length)
      return { cur: 0, prev: 0, diff: 0, rate: 0 };
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

  useEffect(() => {
    if (!driver?.components?.length) {
      setAutoTrace(null);
      setActiveComponent(null);
      setDrillStack([]);
      return;
    }
    const top = driver.components
      .slice()
      .sort(
        (a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib))
      )[0];
    if (!top) return;

    setAutoTrace(null);
    setActiveComponent(top.component);
    setDrillStack([
      {
        key: joinPath([top.component]),
        label: top.component,
        parts: [top.component],
      },
    ]);
    setShowAllChildren(false);
    setChildFilter("");
    setSortMode("absdiff");
  }, [activeKpi, driver]);

  const expectedChildren = useMemo(() => {
    if (!currentDrill) return [];
    return PL_TREE[currentDrill.label] || [];
  }, [currentDrill]);

  const availableChildNames = useMemo(
    () => rawCurrentDrillList.map((x) => x.name),
    [rawCurrentDrillList]
  );
  const missingChildren = useMemo(() => {
    const set = new Set(availableChildNames);
    return expectedChildren.filter((n) => !set.has(n));
  }, [expectedChildren, availableChildNames]);

  const currentDrillList = useMemo(() => {
    const list = (rawCurrentDrillList || []).map((x) => {
      const pd = safeNum(parentSummary?.diff);
      const impact = pd ? (safeNum(x.diff) / pd) * 100 : 0;
      return { ...x, impact };
    });

    const q = String(childFilter || "")
      .trim()
      .toLowerCase();
    const filtered = q
      ? list.filter((x) => String(x.name).toLowerCase().includes(q))
      : list;

    const sorted = filtered.slice().sort((a, b) => {
      if (sortMode === "impact")
        return Math.abs(safeNum(b.impact)) - Math.abs(safeNum(a.impact));
      if (sortMode === "rate")
        return Math.abs(safeNum(b.rate)) - Math.abs(safeNum(a.rate));
      return Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff));
    });

    if (showAllChildren) return sorted;
    return sorted.slice(0, 8);
  }, [
    rawCurrentDrillList,
    parentSummary,
    childFilter,
    showAllChildren,
    sortMode,
  ]);

  const runAutoTrace = () => {
    if (!drillStack.length) return;
    const startParts = drillStack[0]?.parts || null;
    if (!startParts || !startParts.length) return;

    const trace = autoTracePath({
      getChildren,
      getHasNext,
      startParts,
      maxDepth: 12,
    });
    setAutoTrace(trace);
    setDrillStack(
      trace.map((t) => ({
        key: joinPath(t.parts),
        label: t.label,
        parts: t.parts,
      }))
    );
  };

  const showFatal = !periods.length && !!error;

  const kpiTabs = ["매출총이익", "영업이익", "당기순이익"];
  const topKpiNames = [
    "매출액",
    "매출총이익",
    "영업이익",
    "당기순이익",
    "매출원가계",
    "판매비와일반관리비",
  ];
  const excludeTop10Roots = [
    ...topKpiNames,
    "영업외손익",
    "영업외수익",
    "영업외비용",
  ];

  const kpiMap = useMemo(() => {
    const map = new Map();
    (kpiCards || []).forEach((k) => map.set(String(k.name), k));
    return map;
  }, [kpiCards]);

  const pickKpi = (name) => {
    const k = kpiMap.get(name);
    const cur = safeNum(k?.cur);
    const prev = safeNum(k?.prev);
    const diff = safeNum(k?.diff ?? cur - prev);
    const rate =
      typeof k?.rate !== "undefined" && k?.rate !== null
        ? safeNum(k.rate)
        : prev
        ? (diff / prev) * 100
        : diff
        ? 100
        : 0;
    return { name, cur, prev, diff, rate };
  };

  const topCompareMetrics = useMemo(() => {
    const sales = pickKpi("매출액");
    const cogs = pickKpi("매출원가계");
    const sga = pickKpi("판매비와일반관리비");
    const net = pickKpi("당기순이익");

    const opCostPrev = safeNum(cogs.prev) + safeNum(sga.prev);
    const opCostCur = safeNum(cogs.cur) + safeNum(sga.cur);
    const opCostDiff = opCostCur - opCostPrev;
    const opCostRate = opCostPrev
      ? (opCostDiff / opCostPrev) * 100
      : opCostDiff
      ? 100
      : 0;

    const opProfitPrev = safeNum(sales.prev) - opCostPrev;
    const opProfitCur = safeNum(sales.cur) - opCostCur;
    const opProfitDiff = opProfitCur - opProfitPrev;
    const opProfitRate = opProfitPrev
      ? (opProfitDiff / opProfitPrev) * 100
      : opProfitDiff
      ? 100
      : 0;

    return [
      { key: "매출액", label: "매출액", ...sales },
      {
        key: "영업비용",
        label: "영업비용",
        prev: opCostPrev,
        cur: opCostCur,
        diff: opCostDiff,
        rate: opCostRate,
      },
      {
        key: "영업이익",
        label: "영업이익",
        prev: opProfitPrev,
        cur: opProfitCur,
        diff: opProfitDiff,
        rate: opProfitRate,
      },
      { key: "당기순이익", label: "당기순이익", ...net },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiMap]);

  const jumpToLevel = (idx) => {
    if (idx < 0) return;
    setAutoTrace(null);
    setDrillStack(drillStack.slice(0, idx + 1));
    setShowAllChildren(false);
    setChildFilter("");
    setSortMode("absdiff");
  };

  const summarySentence = useMemo(() => {
    if (!viewData) return "";
    return buildSummarySentenceAdvanced({
      activeKpi,
      viewData,
      driver,
      getChildren,
      getHasNext,
    });
  }, [activeKpi, viewData, driver, getChildren, getHasNext]);

  const top10ByRate = useMemo(() => {
    const src = viewData?.top_items || [];
    return buildDetailTop10ByRate(src, {
      excludeRoots: excludeTop10Roots,
      limit: 10,
    });
  }, [viewData, excludeTop10Roots]);

  return (
    <div style={{ width: "100%", background: UI.bgPage, padding: 12 }}>
      {showFatal && (
        <div style={{ color: "#ef4444", fontWeight: 900 }}>{error}</div>
      )}

      {!showFatal && (
        <>
          {loading && (
            <div style={{ fontSize: 12, color: UI.subText, marginBottom: 10 }}>
              불러오는 중...
            </div>
          )}
          {error && !loading && (
            <div
              style={{ color: "#ef4444", fontWeight: 900, marginBottom: 10 }}
            >
              {error}
            </div>
          )}

          {!loading && !error && viewData && (
            <>
              {/* ✅ 제일 위: 전월 대비 핵심 지표 (한눈에) */}
              <div style={{ marginBottom: 8 }}>
                <MetricCompareStrip metrics={topCompareMetrics} />
              </div>

              {/* ✅ 바로 아래: AI 결산 상태 요약 (제목/카드 없이 한 줄 스트립) */}
              <div style={{ marginBottom: 12 }}>
                <InlineMoMSummary text={summarySentence} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 420px",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                {/* LEFT */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.05fr 0.95fr",
                      gap: 12,
                    }}
                  >
                    {/* Drivers */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        {kpiTabs.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setActiveKpi(k)}
                            style={{
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: UI.radiusSm,
                              fontWeight: 950,
                              cursor: "pointer",
                              border:
                                activeKpi === k
                                  ? "1px solid #111827"
                                  : "1px solid #E5E7EB",
                              background:
                                activeKpi === k ? "#111827" : "#F3F4F6",
                              color: activeKpi === k ? "#fff" : "#374151",
                              whiteSpace: "nowrap",
                            }}
                            title="원인 분석 KPI 선택"
                          >
                            {k}
                          </button>
                        ))}
                      </div>

                      <Card
                        title={
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 950,
                                color: UI.text,
                              }}
                            >
                              {activeKpi} 변화 요인 (Driver)
                            </div>
                          </div>
                        }
                        right={
                          driver ? (
                            <Chip tone="neutral">
                              KPI Δ{" "}
                              {formatSignedNumber(safeNum(driver.kpi_diff))}
                            </Chip>
                          ) : null
                        }
                      >
                        {!driver ? (
                          <div style={{ fontSize: 12, color: UI.subText }}>
                            드라이버 없음
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            {driver.components.map((c) => {
                              const isActive = activeComponent === c.component;
                              const prev = safeNum(c.prev);
                              const diff = safeNum(c.diff);
                              const rate = prev
                                ? (diff / prev) * 100
                                : diff
                                ? 100
                                : 0;

                              return (
                                <div
                                  key={c.component}
                                  onClick={() => {
                                    setAutoTrace(null);
                                    setActiveComponent(c.component);
                                    setDrillStack([
                                      {
                                        key: joinPath([c.component]),
                                        label: c.component,
                                        parts: [c.component],
                                      },
                                    ]);
                                    setShowAllChildren(false);
                                    setChildFilter("");
                                    setSortMode("absdiff");
                                  }}
                                  style={{
                                    padding: 12,
                                    borderRadius: UI.radius,
                                    border: isActive
                                      ? "1px solid #111827"
                                      : UI.border,
                                    background: "#fff",
                                    cursor: "pointer",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "baseline",
                                      gap: 10,
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 950,
                                        minWidth: 0,
                                        color: UI.text,
                                      }}
                                    >
                                      <span
                                        style={{
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {c.component}
                                      </span>
                                      <span
                                        style={{
                                          marginLeft: 8,
                                          fontSize: 11,
                                          color: UI.subText,
                                        }}
                                      >
                                        (기여{" "}
                                        {formatSignedNumber(safeNum(c.contrib))}
                                        )
                                      </span>
                                    </div>
                                    <Chip
                                      tone={
                                        toneForValue(c.contrib) === "pos"
                                          ? "red"
                                          : toneForValue(c.contrib) === "neg"
                                          ? "green"
                                          : "neutral"
                                      }
                                    >
                                      {formatSignedNumber(safeNum(c.contrib))}
                                    </Chip>
                                  </div>

                                  <div style={{ marginTop: 8 }}>
                                    <Bar
                                      value={safeNum(c.contrib)}
                                      maxAbs={driverMaxAbs}
                                      height={10}
                                    />
                                  </div>

                                  <div
                                    style={{
                                      marginTop: 8,
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontSize: 11,
                                      color: UI.subText,
                                    }}
                                  >
                                    <span>
                                      {formatNumber(prev)} →{" "}
                                      {formatNumber(safeNum(c.cur))}
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: 950,
                                        color: UI.text,
                                      }}
                                    >
                                      Δ {formatSignedNumber(diff)} (
                                      {formatRate(rate)})
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    </div>

                    {/* Drilldown */}
                    <Card
                      title={
                        drillStack.length
                          ? `변동 원인 상세 (Drill-down) — ${
                              drillStack[drillStack.length - 1].label
                            }`
                          : "변동 원인 상세 (Drill-down)"
                      }
                      right={
                        drillStack.length ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              justifyContent: "flex-end",
                              alignItems: "center",
                            }}
                          >
                            <Chip
                              tone={
                                backendDrilldowns?.[
                                  drillStack[drillStack.length - 1].label
                                ]?.length
                                  ? "blue"
                                  : flatItems.length
                                  ? "green"
                                  : "amber"
                              }
                            >
                              source:{" "}
                              {backendDrilldowns?.[
                                drillStack[drillStack.length - 1].label
                              ]?.length
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

                            <Button
                              tone="outline"
                              disabled={!drillStack.length}
                              onClick={runAutoTrace}
                            >
                              Auto Trace
                            </Button>
                          </div>
                        ) : (
                          <Chip tone="neutral">좌측 Driver 클릭</Chip>
                        )
                      }
                    >
                      {/* (이 아래는 네 코드 그대로) */}
                      {!drillStack.length ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: UI.subText,
                            lineHeight: 1.6,
                          }}
                        >
                          Driver를 클릭하면 하위 항목이 뜹니다.
                        </div>
                      ) : rawCurrentDrillList.length === 0 ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: UI.subText,
                            lineHeight: 1.6,
                          }}
                        >
                          이 레벨에서 하위 데이터가 없습니다(leaf 또는 누락).
                          아래 Missing을 확인하세요.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          {/* Breadcrumb */}
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                            }}
                          >
                            {drillStack.map((d, idx) => (
                              <Button
                                key={d.key}
                                tone={
                                  idx === drillStack.length - 1
                                    ? "solid"
                                    : "ghost"
                                }
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
                            <div
                              style={{
                                border: UI.border,
                                borderRadius: UI.radius,
                                background: "#fff",
                                padding: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  alignItems: "center",
                                }}
                              >
                                <div
                                  style={{ fontWeight: 950, color: UI.text }}
                                >
                                  Parent 요약
                                </div>
                                <Chip
                                  tone={
                                    safeNum(parentSummary.diff) >= 0
                                      ? "red"
                                      : "green"
                                  }
                                >
                                  Δ {formatSignedNumber(parentSummary.diff)} (
                                  {formatRate(parentSummary.rate)})
                                </Chip>
                              </div>
                              <div
                                style={{
                                  marginTop: 8,
                                  fontSize: 12,
                                  color: UI.subText,
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span>
                                  전월 {formatNumber(parentSummary.prev)}
                                </span>
                                <span>→</span>
                                <span>
                                  당월 {formatNumber(parentSummary.cur)}
                                </span>
                                <span style={{ color: "#9CA3AF" }}>|</span>
                                <span
                                  style={{ fontWeight: 900, color: UI.text }}
                                >
                                  Impact로 “누가 움직였는지” 확인
                                </span>
                              </div>
                            </div>
                          )}

                          {/* AutoTrace */}
                          {autoTrace && autoTrace.length > 1 && (
                            <div
                              style={{
                                border: "1px dashed #CBD5E1",
                                borderRadius: UI.radius,
                                background: UI.bgSoft,
                                padding: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <div
                                  style={{ fontWeight: 950, color: UI.text }}
                                >
                                  원인 트리 (자동 경로)
                                </div>
                                <Chip tone="blue">leaf</Chip>
                              </div>
                              <div
                                style={{
                                  marginTop: 10,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                  fontSize: 12,
                                }}
                              >
                                {autoTrace.map((t, idx) => {
                                  const v = t.value;
                                  return (
                                    <div
                                      key={joinPath(t.parts)}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 10,
                                      }}
                                    >
                                      <span style={{ color: UI.text }}>
                                        {idx === 0 ? "Start" : `L${idx}`} :{" "}
                                        <b>{t.label}</b>
                                      </span>
                                      <span
                                        style={{
                                          fontWeight: 950,
                                          color: "#1D4ED8",
                                        }}
                                      >
                                        {v
                                          ? `Δ ${formatSignedNumber(
                                              safeNum(v.diff)
                                            )} (${formatRate(safeNum(v.rate))})`
                                          : ""}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* controls */}
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <Button
                              tone={showAllChildren ? "ghost" : "solid"}
                              onClick={() => setShowAllChildren(false)}
                            >
                              TOP 8
                            </Button>
                            <Button
                              tone={showAllChildren ? "solid" : "ghost"}
                              onClick={() => setShowAllChildren(true)}
                            >
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
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            {currentDrillList.map((x) => {
                              const nextParts = [
                                ...(currentDrill?.parts || []),
                                x.name,
                              ];
                              const hasNext = getHasNext(nextParts);

                              const impact = safeNum(x.impact);
                              const signTone =
                                toneForValue(x.diff) === "pos"
                                  ? "red"
                                  : toneForValue(x.diff) === "neg"
                                  ? "green"
                                  : "neutral";
                              const impactTone =
                                Math.abs(impact) >= 50
                                  ? impact >= 0
                                    ? "red"
                                    : "green"
                                  : Math.abs(impact) >= 20
                                  ? "blue"
                                  : "neutral";

                              return (
                                <div
                                  key={joinPath(nextParts)}
                                  onClick={() => {
                                    if (!hasNext) return;
                                    setAutoTrace(null);
                                    setDrillStack([
                                      ...drillStack,
                                      {
                                        key: joinPath(nextParts),
                                        label: x.name,
                                        parts: nextParts,
                                      },
                                    ]);
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
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "baseline",
                                      gap: 10,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        alignItems: "baseline",
                                        minWidth: 0,
                                      }}
                                    >
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
                                      {hasNext ? (
                                        <Chip tone="dark">drill</Chip>
                                      ) : (
                                        <Chip tone="neutral">leaf</Chip>
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        justifyContent: "flex-end",
                                      }}
                                    >
                                      <Chip
                                        tone={impactTone}
                                        title="Parent 변화(증감액) 중 이 항목 비중"
                                      >
                                        Impact {formatRate(impact)}
                                      </Chip>
                                      <Chip tone={signTone}>
                                        Δ {formatSignedNumber(safeNum(x.diff))}{" "}
                                        ({formatRate(safeNum(x.rate))})
                                      </Chip>
                                    </div>
                                  </div>

                                  <div style={{ marginTop: 8 }}>
                                    <Bar
                                      value={safeNum(x.diff)}
                                      maxAbs={drillMaxAbs}
                                      height={10}
                                    />
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
                                    <div
                                      style={{
                                        border: UI.border,
                                        borderRadius: UI.radiusSm,
                                        padding: "8px 10px",
                                        background: UI.bgSoft,
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 900,
                                          color: UI.text,
                                        }}
                                      >
                                        전월
                                      </div>
                                      <div style={{ marginTop: 4 }}>
                                        {formatNumber(safeNum(x.prev))}
                                      </div>
                                    </div>
                                    <div
                                      style={{
                                        border: UI.border,
                                        borderRadius: UI.radiusSm,
                                        padding: "8px 10px",
                                        background: UI.bgSoft,
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 900,
                                          color: UI.text,
                                        }}
                                      >
                                        당월
                                      </div>
                                      <div style={{ marginTop: 4 }}>
                                        {formatNumber(safeNum(x.cur))}
                                      </div>
                                    </div>
                                    <div
                                      style={{
                                        border: UI.border,
                                        borderRadius: UI.radiusSm,
                                        padding: "8px 10px",
                                        background: UI.bgSoft,
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 900,
                                          color: UI.text,
                                        }}
                                      >
                                        해석
                                      </div>
                                      <div
                                        style={{
                                          marginTop: 4,
                                          fontWeight: 900,
                                          color: UI.text,
                                        }}
                                      >
                                        {safeNum(x.diff) >= 0
                                          ? `Rate ${formatRate(
                                              safeNum(x.rate)
                                            )} ↑ / Impact ${formatRate(impact)}`
                                          : `Rate ${formatRate(
                                              safeNum(x.rate)
                                            )} ↓ / Impact ${formatRate(
                                              impact
                                            )}`}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {missingChildren.length > 0 && (
                            <div
                              style={{
                                padding: 12,
                                borderRadius: UI.radius,
                                border: "1px solid #FDE68A",
                                background: "#FFFBEB",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 950,
                                  color: "#92400E",
                                  marginBottom: 8,
                                }}
                              >
                                누락 가능(마감/매핑/데이터 미반영 의심)
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 8,
                                }}
                              >
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

                {/* RIGHT */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div style={{ height: 1 }} />
                  <Top10Card
                    title="전체 증감 비율 Top 10 (세부항목)"
                    items={top10ByRate}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
