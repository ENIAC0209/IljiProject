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

  return { path, cur, prev, diff, rate, _raw: raw };
}

function buildChildrenFromPathItems(flatItems, prefixParts) {
  const depth = prefixParts.length;

  const under = flatItems.filter((it) => {
    if (!it.path) return false;
    const parts = splitPath(it.path);
    if (parts.length <= depth) return false;
    for (let i = 0; i < depth; i++)
      if (parts[i] !== prefixParts[i]) return false;
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
    for (let i = 0; i < depth; i++)
      if (parts[i] !== prefixParts[i]) return false;
    return true;
  });
}

/* =========================
 * 기대 드릴다운 트리
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
 * Design tokens (전문적 + 각진)
 * ========================= */
const UI = {
  bg: "#F3F6FB",
  card: "#FFFFFF",
  text: "#0B1220",
  sub: "#516074",
  line: "rgba(15, 23, 42, 0.12)",

  // ✅ 각진
  radius: 6,
  radiusLg: 8,

  // ✅ 얇은 그림자
  shadow: "0 1px 2px rgba(15,23,42,0.06)",
  shadowSm: "0 1px 1px rgba(15,23,42,0.05)",

  mono: { fontVariantNumeric: "tabular-nums" },

  // ✅ 톤: 증가(비용↑) = Red, 감소 = Green
  good: "#15803D",
  bad: "#B91C1C",
  neutral: "#334155",

  goodBg: "rgba(21, 128, 61, 0.10)",
  badBg: "rgba(185, 28, 28, 0.10)",
  neutralBg: "rgba(148, 163, 184, 0.16)",

  // ✅ Impact 전용
  blue: "#2563EB",
  blueBg: "rgba(37, 99, 235, 0.12)",
  gray: "#475569",
  grayBg: "rgba(148, 163, 184, 0.16)",

  amberBg: "rgba(245, 158, 11, 0.12)",
};

function signTone(v) {
  const n = safeNum(v);
  if (n > 0) return "pos";
  if (n < 0) return "neg";
  return "zero";
}
function pickColor(tone) {
  if (tone === "pos")
    return { fg: UI.bad, bg: UI.badBg, bd: "rgba(185,28,28,0.26)" };
  if (tone === "neg")
    return { fg: UI.good, bg: UI.goodBg, bd: "rgba(21,128,61,0.26)" };
  return {
    fg: UI.gray,
    bg: UI.neutralBg,
    bd: "rgba(148,163,184,0.28)",
  };
}
function pickBlue() {
  return { fg: UI.blue, bg: UI.blueBg, bd: "rgba(37,99,235,0.28)" };
}
function pickGray() {
  return { fg: UI.gray, bg: UI.grayBg, bd: "rgba(148,163,184,0.28)" };
}

/* ✅ Impact: 증감 방향 무관, 영향(0 제외)이면 파랑 / 아니면 회색 */
/* ✅ Impact: 증감 방향 무관, 영향(미미 제외)이면 파랑 / 아니면 회색 */
function impactTone(impactPct, parentDiff) {
  const pd = safeNum(parentDiff);
  const ii = safeNum(impactPct);

  // parent Δ=0이면 impact 의미 없음 -> 회색
  if (Math.abs(pd) < 1e-9) return "gray";

  // ✅ "미미" 기준: Impact 절대값이 3% 미만이면 회색 (원하면 숫자만 조절)
  const MIN_IMPACT_PCT = 5;

  if (Math.abs(ii) < MIN_IMPACT_PCT) return "gray";

  return "blue";
}

/* =========================
 * Small UI atoms
 * ========================= */
function Card({ title, right, children, style }) {
  return (
    <div
      style={{
        position: "relative", // ✅ 중요
        background: UI.card,
        border: `1px solid ${UI.line}`,
        borderRadius: UI.radiusLg,

        // ✅ 위쪽 그림자 거의 없고, 아래만 남김
        boxShadow: "0 2px 4px rgba(15,23,42,0.04)",

        padding: 16,
        ...style,
      }}
    >
      {/* ✅ 탭 아래쪽 그림자 가리기용 마스크 */}
      <div
        style={{
          position: "absolute",
          top: -1,
          left: 0,
          right: 0,
          height: 12, // 탭이 닿는 영역만
          background: UI.card,
          borderTopLeftRadius: UI.radiusLg,
          borderTopRightRadius: UI.radiusLg,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* 실제 콘텐츠 */}
      <div style={{ position: "relative", zIndex: 2 }}>
        {(title || right) && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: UI.text }}>
              {title}
            </div>
            {right}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Pill({ children, tone = "neutral", title, style }) {
  const t =
    tone === "blue"
      ? pickBlue()
      : tone === "gray"
      ? pickGray()
      : tone === "amber"
      ? { fg: "#92400E", bg: UI.amberBg, bd: "rgba(245,158,11,0.26)" }
      : tone === "pos"
      ? pickColor("pos")
      : tone === "neg"
      ? pickColor("neg")
      : pickColor("zero");

  return (
    <span
      title={title || ""}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: UI.radius, // ✅ 각진
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.fg,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function SegButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "9px 12px",
        borderRadius: UI.radiusLg,
        border: `1px solid ${active ? "rgba(15,23,42,0.22)" : UI.line}`,
        background: active ? "#0B1220" : "#FFFFFF",
        color: active ? "#fff" : UI.text,
        fontSize: 12,
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: active ? UI.shadowSm : "none",
      }}
    >
      {children}
    </button>
  );
}
function IndexTab({ active, label, onClick }) {
  // ✅ 탭별 컬러 지정 (원하는대로 바꿔도 됨)
  const TAB_COLORS = {
    영업이익: { on: "#2563EB", off: "rgba(37,99,235,0.35)" }, // Blue
    당기순이익: { on: "#7C3AED", off: "rgba(124,58,237,0.32)" }, // Purple
  };

  const c = TAB_COLORS[label] || { on: UI.blue, off: "rgba(148,163,184,0.55)" };

  const tabStyle = {
    position: "relative",
    height: 30,
    padding: "0 12px",
    borderRadius: "10px 10px 4px 4px",
    border: "1px solid rgba(15, 23, 42, 0.14)",
    borderBottom: "1px solid #ffffff",
    background: active ? "#ffffff" : "rgba(15,23,42,0.03)",
    color: active ? UI.text : "rgba(81,96,116,0.95)",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "none",
    transform: "translateY(1px)",
    transition: "all 120ms ease",
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={tabStyle}
      aria-pressed={active}
    >
      {/* ✅ 상단 색띠: 탭마다 다르게 */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 3,
          background: active ? c.on : c.off,
        }}
      />
      <span style={{ paddingTop: 1, marginLeft: -2 }}>{label}</span>
    </button>
  );
}

/* ✅ 기존(단방향) 바 */
function BarMeter({ value, maxAbs }) {
  const v = safeNum(value);
  const m = Math.max(1e-9, safeNum(maxAbs, 1));
  const w = clamp((Math.abs(v) / m) * 100, 0, 100);
  const c = pickColor(signTone(v));

  return (
    <div
      style={{
        height: 10,
        borderRadius: UI.radius, // ✅ 각진
        background: "rgba(15,23,42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${w}%`,
          background: c.fg,
          opacity: 0.9,
        }}
      />
    </div>
  );
}

/* ✅ KPI 전용(중앙 0) diverging bar */
function DivergingBar({ value, maxAbs, title }) {
  const v = safeNum(value);
  const m = Math.max(1e-9, safeNum(maxAbs, 1));
  const p = clamp((Math.abs(v) / m) * 50, 0, 50);
  const tone = pickColor(signTone(v));
  const isNeg = v < 0;
  const isZero = Math.abs(v) < 1e-9;

  return (
    <div
      style={{
        position: "relative",
        height: 10,
        borderRadius: UI.radius, // ✅ 각진
        background: "rgba(15,23,42,0.06)",
        overflow: "hidden",
      }}
      title={title || (isZero ? "0" : String(v))}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: "rgba(15,23,42,0.20)",
        }}
      />
      {isNeg && (
        <div
          style={{
            position: "absolute",
            right: "50%",
            top: 0,
            bottom: 0,
            width: `${p}%`,
            background: tone.fg,
            opacity: 0.9,
          }}
        />
      )}
      {!isNeg && !isZero && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: `${p}%`,
            background: tone.fg,
            opacity: 0.9,
          }}
        />
      )}
    </div>
  );
}

/* =========================
 * KPI Strip (4 KPI)
 * ========================= */
function KpiStrip({ items = [] }) {
  const maxAbsRate = useMemo(() => {
    const m = Math.max(1, ...items.map((x) => Math.abs(safeNum(x.rate))));
    return m;
  }, [items]);

  return (
    <div
      style={{
        background: UI.card,
        border: `1px solid ${UI.line}`,
        borderRadius: UI.radiusLg,
        boxShadow: UI.shadow,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
          gap: 10,
          alignItems: "stretch",
        }}
      >
        {items.map((it) => {
          const tone = pickColor(signTone(it.diff));
          const rr = safeNum(it.rate);

          return (
            <div
              key={it.key}
              style={{
                border: `1px solid ${UI.line}`,
                borderRadius: UI.radiusLg,
                padding: 12,
                background: "rgba(15,23,42,0.02)",
                minWidth: 0,
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
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: UI.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={it.label}
                >
                  {it.label}
                </div>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: UI.radius, // ✅ 각진
                    border: `1px solid ${tone.bd}`,
                    background: tone.bg,
                    color: tone.fg,
                    fontSize: 12,
                    fontWeight: 900,
                    ...UI.mono,
                    whiteSpace: "nowrap",
                  }}
                  title="전월 대비 Δ(금액)"
                >
                  Δ {formatSignedNumber(it.diff)}
                </span>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: UI.sub }}>
                    전월
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 14,
                      fontWeight: 900,
                      color: UI.text,
                      ...UI.mono,
                    }}
                  >
                    {formatNumber(it.prev)}
                  </div>
                </div>

                <div style={{ textAlign: "right", minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: UI.sub }}>
                    당월
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 14,
                      fontWeight: 900,
                      color: UI.text,
                      ...UI.mono,
                    }}
                  >
                    {formatNumber(it.cur)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  color: UI.sub,
                }}
              >
                <span>감소</span>
                <span style={{ ...UI.mono }}>0</span>
                <span>증가</span>
              </div>

              <div style={{ marginTop: 6 }}>
                <DivergingBar
                  value={rr}
                  maxAbs={maxAbsRate}
                  title={`증감률 ${formatRate(rr)} / Δ ${formatSignedNumber(
                    it.diff
                  )}`}
                />
              </div>

              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: UI.sub,
                    ...UI.mono,
                  }}
                  title="증감률(%)"
                >
                  {formatRate(rr)}
                </span>
                <Pill tone="blue" style={{ fontSize: 11 }}>
                  전월→당월
                </Pill>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function AiConclusionBox({ activeKpi, kpi, topDrivers = [], kpiDiff = 0 }) {
  const [open, setOpen] = React.useState(false);

  const main = kpi || { prev: 0, cur: 0, diff: 0, rate: 0 };
  const diff = safeNum(main.diff);
  const prev = safeNum(main.prev);
  const cur = safeNum(main.cur);
  const rate = safeNum(main.rate);

  const dirWord =
    diff > 0 ? "증가" : diff < 0 ? "감소" : "변동이 거의 없습니다";
  const dirTone = signTone(diff);
  const pillTone =
    dirTone === "pos" ? "pos" : dirTone === "neg" ? "neg" : "neutral";

  const t1 = topDrivers?.[0];
  const t2 = topDrivers?.[1];
  const t3 = topDrivers?.[2];

  const topSum =
    safeNum(t1?.contrib) + safeNum(t2?.contrib) + safeNum(t3?.contrib);

  const explainPct = Math.abs(diff) > 1e-9 ? (topSum / diff) * 100 : 0;

  const summary1 = `${activeKpi}이(가) 전월 대비 ${dirWord}했습니다.`;
  const summary2 = `전월 ${formatNumber(prev)} → 당월 ${formatNumber(
    cur
  )} (Δ ${formatSignedNumber(diff)}, ${formatRate(rate)})`;
  const summary3 = t1
    ? `주요 요인: ${t1.component}(${formatSignedNumber(safeNum(t1.contrib))})`
    : "주요 요인 데이터가 없습니다.";

  return (
    <div
      style={{
        background: UI.card,
        border: `1px solid ${UI.line}`,
        borderRadius: UI.radiusLg,
        boxShadow: UI.shadow,
        padding: 14,
        marginBottom: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 950, color: UI.text }}>
          AI 결론
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill tone={pillTone}>{dirWord}</Pill>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              padding: "6px 10px",
              borderRadius: UI.radiusLg,
              border: `1px solid ${UI.line}`,
              background: open ? "rgba(15,23,42,0.04)" : "#fff",
              color: UI.text,
              fontSize: 11,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {open ? "상세 닫기" : "상세 보기"}
          </button>
        </div>
      </div>

      {/* Summary (항상 표시) */}
      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 950,
            color: UI.text,
            lineHeight: 1.7,
          }}
        >
          {summary1}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 850,
            color: UI.sub,
            lineHeight: 1.7,
          }}
        >
          {summary2}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 850,
            color: "rgba(100,116,139,0.95)",
            lineHeight: 1.7,
          }}
        >
          {summary3}
        </div>
      </div>

      {/* Detail (토글) */}
      {open && (
        <div
          style={{
            marginTop: 12,
            borderTop: `1px solid ${UI.line}`,
            paddingTop: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: UI.text }}>
            주요 변화 요인(TOP3)
          </div>

          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {[t1, t2, t3].filter(Boolean).length === 0 ? (
              <div style={{ fontSize: 12, color: UI.sub }}>
                Driver 데이터가 없습니다.
              </div>
            ) : (
              [t1, t2, t3].filter(Boolean).map((d, i) => (
                <div
                  key={d.component}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                    fontSize: 11,
                    fontWeight: 850,
                    color: UI.sub,
                  }}
                >
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {i + 1}) {d.component}
                  </span>
                  <Pill tone={signTone(d.contrib)} style={{ fontSize: 11 }}>
                    {formatSignedNumber(safeNum(d.contrib))}
                  </Pill>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              fontWeight: 850,
              color: "rgba(100,116,139,0.95)",
              lineHeight: 1.6,
            }}
          >
            {Math.abs(diff) < 1e-9
              ? "KPI Δ가 0에 가까워 TOP3 설명 비중을 계산하지 않습니다."
              : `TOP3 합은 KPI Δ의 ${formatRate(
                  explainPct
                )} 수준입니다. (집계/반올림/분류 기준에 따라 100%와 다를 수 있음)`}
          </div>

          <div
            style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <Pill tone="gray" title="KPI Δ(보조)">
              보조: KPI Δ {formatSignedNumber(safeNum(kpiDiff))}
            </Pill>
            {t1 && <Pill tone="blue">1위 요인 클릭 → 세부요인 추적</Pill>}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
 * KPI Header
 * ========================= */
function KpiHeader({
  activeKpi,
  kpi,
  topDrivers = [],
  kpiDiff = 0,
  activeComponent,
  onPickDriver,
  parentSummary,
}) {
  const main = kpi || { prev: 0, cur: 0, diff: 0, rate: 0 };
  const rateTone = pickColor(signTone(main.rate));
  const maxAbsContrib = Math.max(
    1,
    ...topDrivers.map((x) => Math.abs(safeNum(x.contrib)))
  );

  return (
    <div
      style={{
        background: UI.card,
        border: `1px solid ${UI.line}`,
        borderRadius: UI.radiusLg,
        boxShadow: UI.shadow,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "stretch",
          flexWrap: "wrap",
        }}
      >
        {/* LEFT */}
        <div style={{ minWidth: 280, flex: "0 0 auto" }}>
          <div style={{ fontSize: 18, fontWeight: 950, color: UI.text }}>
            {activeKpi} 변화 핵심
          </div>

          <div
            style={{
              marginTop: 10,
              borderRadius: UI.radiusLg,
              border: `1px solid ${rateTone.bd}`,
              background: rateTone.bg,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, color: UI.sub }}>
              전월 대비 증감률
            </div>

            <div
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "baseline",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 950,
                  color: rateTone.fg,
                  letterSpacing: "-0.02em",
                  ...UI.mono,
                }}
              >
                {formatRate(main.rate)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 900, color: UI.sub }}>
                (Δ {formatSignedNumber(main.diff)})
              </span>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                color: UI.sub,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <span style={{ ...UI.mono }}>전월 {formatNumber(main.prev)}</span>
              <span>→</span>
              <span style={{ ...UI.mono }}>당월 {formatNumber(main.cur)}</span>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <Pill tone={signTone(kpiDiff)} title="KPI 증감(금액)">
              KPI Δ {formatSignedNumber(kpiDiff)}{" "}
              <span style={{ color: UI.sub, fontWeight: 800 }}>(보조)</span>
            </Pill>
          </div>

          {parentSummary && (
            <div
              style={{
                marginTop: 12,
                borderRadius: UI.radiusLg,
                border: `1px solid ${UI.line}`,
                background: "rgba(15,23,42,0.02)",
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, color: UI.text }}>
                  현재 레벨 요약
                </div>
                <Pill tone={signTone(parentSummary.diff)}>
                  Δ {formatSignedNumber(parentSummary.diff)} (
                  {formatRate(parentSummary.rate)})
                </Pill>
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: UI.sub,
                  fontWeight: 800,
                  ...UI.mono,
                }}
              >
                전월 {formatNumber(parentSummary.prev)} → 당월{" "}
                {formatNumber(parentSummary.cur)}
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "rgba(100,116,139,0.95)",
                  fontWeight: 800,
                }}
              >
                Impact = “이 레벨 증감(Δ) 중 해당 항목이 차지하는 비중”
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: TOP3 */}
        <div style={{ minWidth: 340, flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: UI.sub,
              marginBottom: 10,
            }}
          >
            변화 요인 TOP 3 (클릭하면 세부요인 출력)
          </div>

          {topDrivers.length === 0 ? (
            <div style={{ fontSize: 12, color: UI.sub }}>
              Driver 데이터가 없습니다.
            </div>
          ) : (
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}
            >
              {topDrivers.map((d, idx) => {
                const t = pickColor(signTone(d.contrib));
                const isActive = activeComponent === d.component;

                return (
                  <div
                    key={d.component}
                    onClick={() => onPickDriver?.(d.component)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        onPickDriver?.(d.component);
                    }}
                    style={{
                      cursor: "pointer",
                      border: `1px solid ${
                        isActive ? "rgba(15,23,42,0.22)" : UI.line
                      }`,
                      borderRadius: UI.radiusLg,
                      padding: 14,
                      background: isActive ? "#FFFFFF" : "rgba(15,23,42,0.02)",
                      boxShadow: isActive ? UI.shadowSm : "none",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                    title="클릭하면 세부요인"
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: UI.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {idx + 1}. {d.component}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <BarMeter value={d.contrib} maxAbs={maxAbsContrib} />
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: UI.radius,
                            border: `1px solid ${t.bd}`,
                            background: t.bg,
                            color: t.fg,
                            fontSize: 13,
                            fontWeight: 900,
                            ...UI.mono,
                          }}
                          title="기여도(Δ에 기여한 금액)"
                        >
                          기여 {formatSignedNumber(d.contrib)}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: UI.sub,
                            ...UI.mono,
                          }}
                        >
                          (Δ {formatSignedNumber(safeNum(d.diff))} /{" "}
                          {formatRate(
                            safeNum(d.prev)
                              ? (safeNum(d.diff) / safeNum(d.prev)) * 100
                              : safeNum(d.diff)
                              ? 100
                              : 0
                          )}
                          )
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        alignItems: "flex-end",
                      }}
                    >
                      <Pill tone={signTone(d.contrib)} style={{ fontSize: 12 }}>
                        TOP {idx + 1}
                      </Pill>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: UI.radius,
                          background: t.fg,
                          opacity: 0.9,
                        }}
                      />
                      {isActive && <Pill tone="blue">선택됨</Pill>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
 * Backend helpers
 * ========================= */
function aggregateRootTotals(flatItems, rootName) {
  if (!flatItems?.length) return null;
  let cur = 0,
    prev = 0,
    diff = 0,
    hit = 0;

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
 * Main
 * ========================= */
export default function PlReportCauseTab({ selectedYm: selectedYmProp }) {
  const [selectedYm, setSelectedYm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [causeData, setCauseData] = useState(null);

  const [activeKpi, setActiveKpi] = useState("영업이익");
  const [drillStack, setDrillStack] = useState([]);
  const [activeComponent, setActiveComponent] = useState(null);

  const [childFilter, setChildFilter] = useState("");
  const [sortMode, setSortMode] = useState("absdiff");

  useEffect(() => {
    if (selectedYmProp) setSelectedYm(selectedYmProp);
  }, [selectedYmProp]);

  useEffect(() => {
    if (selectedYmProp) return;
    const fetchPeriods = async () => {
      try {
        const res = await fetch("/api/pl-cause/periods");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const list = data.periods || [];
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
  }, [selectedYmProp]);

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

  const kpi4 = useMemo(() => {
    const a = pickKpi("매출액");
    const op = pickKpi("영업이익");
    const ni = pickKpi("당기순이익");
    const oeRaw = kpiMap.has("영업비용")
      ? pickKpi("영업비용")
      : pickKpi("판매비와일반관리비");
    const oe = { ...oeRaw, name: "영업비용" };

    return [
      { key: "sales", label: "매출액", ...a },
      { key: "op", label: "영업이익", ...op },
      { key: "ni", label: "당기순이익", ...ni },
      { key: "oe", label: "영업비용", ...oe },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiMap]);

  const heroKpi = useMemo(() => pickKpi(activeKpi), [activeKpi, kpiMap]); // eslint-disable-line

  const topDrivers = useMemo(() => {
    const list = (driver?.components || []).slice();
    list.sort(
      (a, b) => Math.abs(safeNum(b.contrib)) - Math.abs(safeNum(a.contrib))
    );
    return list.slice(0, 3);
  }, [driver]);

  const onPickDriver = (component) => {
    setActiveComponent(component);
    setDrillStack([
      { key: joinPath([component]), label: component, parts: [component] },
    ]);
    setChildFilter("");
    setSortMode("absdiff");
  };

  useEffect(() => {
    if (!driver?.components?.length) {
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
    onPickDriver(top.component);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKpi, driver]);

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

    return filtered.slice().sort((a, b) => {
      if (sortMode === "impact")
        return Math.abs(safeNum(b.impact)) - Math.abs(safeNum(a.impact));
      if (sortMode === "rate")
        return Math.abs(safeNum(b.rate)) - Math.abs(safeNum(a.rate));
      return Math.abs(safeNum(b.diff)) - Math.abs(safeNum(a.diff));
    });
  }, [rawCurrentDrillList, parentSummary, childFilter, sortMode]);

  const kpiTabs = ["영업이익", "당기순이익"];

  return (
    <div style={{ width: "100%", background: UI.bg, padding: 14 }}>
      {!loading && !error && viewData && <KpiStrip items={kpi4} />}

      {/* ✅ 인덱스 탭 트레이 (PlReportTab의 “탭이 꽂힌” 레이아웃 패턴) :contentReference[oaicite:4]{index=4} */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          width: "100%",
          flexWrap: "nowrap",
          minWidth: 0,

          position: "relative",
          zIndex: 5,
          marginBottom: -4, // -8~-14 사이 취향 조절(PlReportTab은 -13) :contentReference[oaicite:5]{index=5}
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
            flexShrink: 0,
            paddingBottom: 2,
          }}
        >
          {kpiTabs.map((k) => (
            <IndexTab
              key={k}
              label={k}
              active={activeKpi === k}
              onClick={() => setActiveKpi(k)}
            />
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: UI.sub, fontWeight: 800 }}>
          불러오는 중...
        </div>
      )}
      {error && !loading && (
        <div style={{ fontSize: 12, color: UI.bad, fontWeight: 900 }}>
          {error}
        </div>
      )}

      {!loading && !error && viewData && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <AiConclusionBox
                activeKpi={activeKpi}
                kpi={heroKpi}
                topDrivers={topDrivers}
                kpiDiff={safeNum(driver?.kpi_diff)}
              />
              <KpiHeader
                activeKpi={activeKpi}
                kpi={heroKpi}
                topDrivers={topDrivers}
                kpiDiff={safeNum(driver?.kpi_diff)}
                activeComponent={activeComponent}
                onPickDriver={onPickDriver}
                parentSummary={parentSummary}
              />
            </div>
          </div>

          <Card
            title={
              drillStack.length
                ? `세부 요인 — ${drillStack[drillStack.length - 1].label}`
                : "세부 요인"
            }
            style={{ paddingTop: 18 }} // ✅ 기본 16 -> 18 (탭과 카드 콘텐츠 간격 확보)
          >
            {!drillStack.length ? (
              <div style={{ fontSize: 12, color: UI.sub, lineHeight: 1.7 }}>
                상단의 <b style={{ color: UI.text }}>변화 요인 TOP3</b>를
                클릭하면, 해당 항목부터{" "}
                <b style={{ color: UI.text }}>전월→당월 변화</b>를 드릴다운으로
                추적합니다.
              </div>
            ) : rawCurrentDrillList.length === 0 ? (
              <div style={{ fontSize: 12, color: UI.sub, lineHeight: 1.7 }}>
                이 레벨에서 하위 데이터가 없습니다. 아래 “누락 가능”을
                확인하세요.
              </div>
            ) : (
              <>
                {/* Controls */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <input
                    value={childFilter}
                    onChange={(e) => setChildFilter(e.target.value)}
                    placeholder="항목 검색"
                    style={{
                      flex: 1,
                      minWidth: 220,
                      padding: "10px 12px",
                      borderRadius: UI.radiusLg,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                      outline: "none",
                      fontWeight: 800,
                      fontSize: 12,
                      color: UI.text,
                      boxShadow: "inset 0 1px 0 rgba(15,23,42,0.03)",
                    }}
                  />

                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: UI.radiusLg,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                      fontWeight: 800,
                      fontSize: 12,
                      color: UI.text,
                      outline: "none",
                    }}
                  >
                    <option value="absdiff">증감액</option>
                    <option value="impact">Impact</option>
                    <option value="rate">증감률</option>
                  </select>
                </div>

                {/* Table */}
                <div
                  style={{
                    border: `1px solid ${UI.line}`,
                    borderRadius: UI.radiusLg,
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1.2fr 0.7fr 0.7fr 0.9fr 0.7fr 0.6fr",
                      background: "rgba(15,23,42,0.03)",
                      padding: "10px 12px",
                      fontSize: 11,
                      fontWeight: 900,
                      color: UI.sub,
                    }}
                  >
                    <div>항목</div>
                    <div style={{ textAlign: "right" }}>증감률</div>
                    <div style={{ textAlign: "right" }}>Impact</div>
                    <div style={{ textAlign: "right" }}>증감(Δ)</div>
                    <div style={{ textAlign: "right" }}>전월</div>
                    <div style={{ textAlign: "right" }}>당월</div>
                  </div>

                  {currentDrillList.map((x) => {
                    const nextParts = [...(currentDrill?.parts || []), x.name];
                    const hasNext = getHasNext(nextParts);
                    const diff = safeNum(x.diff);

                    return (
                      <div
                        key={joinPath(nextParts)}
                        onClick={() => {
                          if (!hasNext) return;
                          setDrillStack([
                            ...drillStack,
                            {
                              key: joinPath(nextParts),
                              label: x.name,
                              parts: nextParts,
                            },
                          ]);
                          setChildFilter("");
                          setSortMode("absdiff");
                        }}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "1.2fr 0.7fr 0.7fr 0.9fr 0.7fr 0.6fr",
                          padding: "12px 12px",
                          borderTop: `1px solid ${UI.line}`,
                          background: hasNext ? "#fff" : "rgba(15,23,42,0.01)",
                          cursor: hasNext ? "pointer" : "default",
                          alignItems: "center",
                        }}
                      >
                        {/* 항목 + 바 */}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 900,
                                color: UI.text,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={x.name}
                            >
                              {x.name}
                            </div>
                            {hasNext && (
                              <Pill tone="gray" style={{ fontSize: 10 }}>
                                Drill
                              </Pill>
                            )}
                          </div>

                          <div style={{ marginTop: 8 }}>
                            <BarMeter value={diff} maxAbs={drillMaxAbs || 1} />
                          </div>
                        </div>

                        {/* 증감률 */}
                        <div style={{ textAlign: "right" }}>
                          {(() => {
                            const rr = safeNum(x.rate);
                            const cc = pickColor(signTone(rr));
                            return (
                              <span
                                style={{
                                  display: "inline-flex",
                                  padding: "6px 10px",
                                  borderRadius: UI.radius,
                                  border: `1px solid ${cc.bd}`,
                                  background: cc.bg,
                                  color: cc.fg,
                                  fontSize: 13,
                                  fontWeight: 900,
                                  ...UI.mono,
                                }}
                                title="증감률(%)"
                              >
                                {formatRate(rr)}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Impact (파랑/회색만) */}
                        <div style={{ textAlign: "right" }}>
                          {(() => {
                            const ii = safeNum(x.impact);
                            const tone = impactTone(ii, parentSummary?.diff);
                            const cc =
                              tone === "blue" ? pickBlue() : pickGray();
                            const parentZero =
                              Math.abs(safeNum(parentSummary?.diff)) < 1e-9;

                            return (
                              <span
                                style={{
                                  display: "inline-flex",
                                  padding: "6px 10px",
                                  borderRadius: UI.radius,
                                  border: `1px solid ${cc.bd}`,
                                  background: cc.bg,
                                  color: cc.fg,
                                  fontSize: 13,
                                  fontWeight: 900,
                                  ...UI.mono,
                                }}
                                title={
                                  parentZero
                                    ? "Parent Δ=0 → Impact 의미 없음"
                                    : "Parent Δ 대비 비중"
                                }
                              >
                                {parentZero ? "—" : formatRate(ii)}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Δ */}
                        <div
                          style={{
                            textAlign: "right",
                            fontSize: 12,
                            fontWeight: 900,
                            color: UI.text,
                            ...UI.mono,
                          }}
                        >
                          {formatSignedNumber(diff)}
                        </div>

                        {/* 전월 */}
                        <div
                          style={{
                            textAlign: "right",
                            fontSize: 12,
                            fontWeight: 800,
                            color: UI.sub,
                            ...UI.mono,
                          }}
                        >
                          {formatNumber(safeNum(x.prev))}
                        </div>

                        {/* 당월 */}
                        <div
                          style={{
                            textAlign: "right",
                            fontSize: 12,
                            fontWeight: 800,
                            color: UI.sub,
                            ...UI.mono,
                          }}
                        >
                          {formatNumber(safeNum(x.cur))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {missingChildren.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: UI.radiusLg,
                      border: "1px solid rgba(245,158,11,0.26)",
                      background: UI.amberBg,
                      padding: 14,
                      fontSize: 12,
                      fontWeight: 900,
                      color: "#92400E",
                    }}
                  >
                    누락 가능: {missingChildren.join(", ")}
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
