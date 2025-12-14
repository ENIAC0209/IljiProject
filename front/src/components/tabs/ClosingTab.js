// =========================
// src/components/tabs/ClosingTab.js  (MODIFIED FULL)
// - 서버(app.py)의 reason_summary / reason_kor / reason_tags를 그대로 활용
// - 프론트 fallback 요약도 포함
// - ✅ 리스트 "사유(요약)"는 무조건 20자 이내로 표시
// - 상세는 reasonFull(원문) 그대로 표시
// - ✅ 탭/필터 변경 시 리스트 스크롤 위치 고정
// =========================
import React, { useMemo, useState, useEffect, useRef } from "react";
import { BRAND_DARK, BRAND_GREEN, BRAND_ORANGE } from "../../config/plConfig";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

// -------------------------
// ✅ 20자 이내로 자르기(리스트용)
// - 한글/영문 모두 "문자 수" 기준
// -------------------------
const clamp20 = (text) => {
  const s = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "-";
  if (s.length <= 20) return s;
  return s.slice(0, 19).trimEnd() + "…";
};

// 상태 뱃지
const StatusBadge = ({ status }) => {
  let bg = "#e5e7eb";
  let txt = "#374151";
  let label = "확인";

  if (status === "issue") {
    bg = "rgba(239, 68, 68, 0.08)";
    txt = "#b91c1c";
    label = "누락";
  } else if (status === "check") {
    bg = "rgba(245, 158, 11, 0.12)";
    txt = "#92400e";
    label = "이상";
  } else if (status === "ok") {
    bg = "rgba(16, 185, 129, 0.12)";
    txt = "#047857";
    label = "정상";
  }

  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 6px",
        borderRadius: 999,
        backgroundColor: bg,
        color: txt,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
};

// -------------------------
// ✅ 사유 요약 생성 (프론트 fallback)
// - 서버 _summarize_reason 규칙을 최대한 존중 + 더 짧게(20자 제한은 clamp20에서 강제)
// -------------------------
const summarizeReasonFallback = (reason, reasonTags, displayIssueType) => {
  const s = String(reason || "")
    .replace(/\s+/g, " ")
    .replace(/원가/g, "원과")
    .trim();

  // 1) 태그가 있으면 태그 1~2개를 우선
  const tags = Array.isArray(reasonTags)
    ? reasonTags.map((x) => String(x).trim()).filter(Boolean)
    : String(reasonTags || "")
        .split(/[,|/]/g)
        .map((x) => x.trim())
        .filter(Boolean);

  if (tags.length) return tags.slice(0, 2).join("·");

  // 2) 결측/비어있음 류
  if (s.includes("금액이 비어") || s.includes("결측") || s.includes("공백")) {
    return "금액 비어있음";
  }

  // 3) "과거에 금액이 존재했으나 이번 달은 0..." 류
  if (s.includes("과거에 금액이 존재")) {
    const has3 = /직전\s*3개월/.test(s);
    const has12 = /직전\s*12개월/.test(s) || /최근\s*12개월/.test(s);
    if (has3) return "3개월 내 금액 존재";
    if (has12) return "12개월 내 금액 존재";
    return "과거 금액 존재";
  }

  // 4) 전월 대비 % 변화만 뽑기
  const pct = s.match(
    /전월[^%]*대비[^%]*([+\-]?\d+(?:\.\d+)?)%\s*(증가|감소)?/
  );
  if (pct) {
    const raw = Number(pct[1]);
    if (!Number.isNaN(raw)) {
      const abs = Math.abs(raw).toFixed(1);
      const dir = pct[2] ? pct[2] : raw >= 0 ? "증가" : "감소";
      return `전월 ${abs}% ${dir}`;
    }
  }

  // 5) 그래도 없으면 타입+첫 문장 앞부분
  const base = String(displayIssueType || "").trim() || "이슈";
  if (!s) return base;
  const first = s.split(" / ")[0].split("\n")[0].trim();
  return `${base}:${first}`;
};

export default function ClosingTab({
  closingAnalysis,
  anomalyResult,
  anomalyLoading,
  anomalyError,
  selectedIssue,
  onIssueRowClick,
  cardStyle,
  closingKpi,
}) {
  const rows = closingAnalysis?.rows || [];
  const hasBackend = !!(anomalyResult && anomalyResult.summary);

  const [issueFilter, setIssueFilter] = useState("all");
  const [viewMode, setViewMode] = useState("issues");
  const [reviewedMap, setReviewedMap] = useState({});
  const [pendingMap, setPendingMap] = useState({});

  // ✅ 리스트 스크롤 위치 고정용 ref
  const listScrollRef = useRef(null);
  const scrollTopRef = useRef(0);

  const buildRowKey = (r) =>
    `${r.costCenter || ""}|${r.accountCode || ""}|${r.month || ""}`;

  const handleTogglePending = (row) => {
    const key = row.rowKey || buildRowKey(row);
    setPendingMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirmSelected = () => {
    setReviewedMap((prevReviewed) => {
      const updated = { ...prevReviewed };
      Object.entries(pendingMap).forEach(([key, val]) => {
        if (val) updated[key] = true;
      });
      return updated;
    });
    setPendingMap({});
  };

  const handleUndoReview = (row) => {
    const key = row.rowKey || buildRowKey(row);
    setReviewedMap((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPendingMap((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const filterBaseStyle = {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    color: "#4b5563",
    fontSize: 10,
    fontWeight: 500,
    lineHeight: "16px",
    cursor: "pointer",
  };

  const confirmBtnStyle = (enabled) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "2px 10px",
    borderRadius: 999,
    border: `1px solid ${enabled ? "#111827" : "#d1d5db"}`,
    backgroundColor: enabled ? "#111827" : "#ffffff",
    color: enabled ? "#ffffff" : "#9ca3af",
    fontSize: 10,
    fontWeight: 700,
    lineHeight: "16px",
    cursor: enabled ? "pointer" : "not-allowed",
    boxShadow: enabled ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
  });

  const tabBaseStyle = {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    color: "#4b5563",
    fontSize: 10,
    fontWeight: 500,
    cursor: "pointer",
  };

  const historyMap = useMemo(() => {
    if (hasBackend && anomalyResult.history) return anomalyResult.history;
    return closingAnalysis?.history || {};
  }, [hasBackend, anomalyResult, closingAnalysis]);

  // ✅ 이슈 rows 생성
  const issueRows = useMemo(() => {
    const source =
      hasBackend && Array.isArray(anomalyResult.issues)
        ? anomalyResult.issues
        : rows;

    let mapped = source.map((r, idx) => {
      const amountRaw = r.amount;
      const amountNum =
        amountRaw === null || amountRaw === undefined
          ? null
          : Number(amountRaw);

      const issueType = r.issue_type || r.issueType || r.issue_type_kor || "-";

      let status = r.status || "check";
      if (issueType === "결측 의심") status = "issue";
      else if (issueType === "정상") status = "ok";
      else if (issueType === "이상치 의심") status = "check";

      if (amountNum === 0 || amountNum === null) status = "issue";

      const costCenterCode =
        r.cost_center || r.cc || r.costCenter || r.costCenterCode;
      const costCenterName =
        r.cc_name || r.costCenterName || costCenterCode || "-";
      const accountCode = r.account_code || r.accountCode || r.acc_code || "-";

      const key =
        r.row_key || r.key || `${costCenterCode || ""}|${accountCode || ""}`;
      const month = r.year_month || r.month;

      const rowKey = `${costCenterCode || ""}|${accountCode || ""}|${
        month || ""
      }`;

      const isReviewed = !!reviewedMap[rowKey];
      const isPending = !!pendingMap[rowKey];

      const rawTags = r.reason_tags ?? r.reasonTags ?? [];
      const reasonTags = Array.isArray(rawTags)
        ? rawTags
            .filter(Boolean)
            .map((x) => String(x).trim())
            .filter(Boolean)
        : String(rawTags)
            .split(/[,|/]/g)
            .map((x) => x.trim())
            .filter(Boolean);

      const reasonFull = r.reason_kor || r.reason || "";

      const displayIssueType =
        r.display_issue_type ||
        (status === "issue" ? "누락" : status === "check" ? "이상" : "정상");

      const reasonSummaryRaw =
        r.reason_summary ||
        summarizeReasonFallback(reasonFull, reasonTags, displayIssueType);

      const reasonSummary = clamp20(reasonSummaryRaw);

      return {
        id: r.id || idx + 1,
        key,
        rowKey,
        month,
        costCenter: costCenterCode,
        costCenterName,
        accountCode,
        accountName:
          r.account_name || r.accountName || r.acc_name || "(계정명 없음)",
        amount: amountNum || 0,
        status,
        reviewed: isReviewed,
        pending: isPending,
        issueType,
        reasonFull,
        reasonSummary,
        reasonTags,
        zscore12: r.zscore_12,
        dev3m: r.dev_3m,
        isoScore: r.iso_score,
        lofScore: r.lof_score,
        patternMean: r.patternMean ?? r.pattern_mean,
        patternUpper: r.patternUpper ?? r.pattern_upper,
        patternLower: r.patternLower ?? r.pattern_lower,
      };
    });

    if (hasBackend) {
      mapped = mapped.filter(
        (r) => r.status === "issue" || r.status === "check"
      );
    }
    return mapped;
  }, [hasBackend, anomalyResult, rows, reviewedMap, pendingMap]);

  const filteredIssueRows = useMemo(() => {
    if (!issueRows.length) return [];

    let tmp = issueRows.filter((r) => !r.reviewed);
    if (issueFilter === "missing")
      tmp = tmp.filter((r) => r.status === "issue");
    else if (issueFilter === "anomaly")
      tmp = tmp.filter((r) => r.status === "check");

    const rank = { issue: 0, check: 1, ok: 2, other: 3 };

    return [...tmp].sort((a, b) => {
      const ra = rank[a.status] ?? 3;
      const rb = rank[b.status] ?? 3;
      if (ra !== rb) return ra - rb;
      return 0;
    });
  }, [issueRows, issueFilter]);

  const reviewedRows = useMemo(
    () => issueRows.filter((r) => r.reviewed),
    [issueRows]
  );

  const ccIssueSummary = useMemo(() => {
    const map = new Map();
    const base = issueRows.filter((r) => !r.reviewed);

    base.forEach((r) => {
      const cc = r.costCenterName || r.costCenter || "-";
      if (!map.has(cc)) map.set(cc, { cc, missing: 0, anomaly: 0, total: 0 });
      const row = map.get(cc);
      row.total += 1;
      if (r.status === "issue") row.missing += 1;
      else if (r.status === "check") row.anomaly += 1;
    });

    const arr = Array.from(map.values());
    arr.sort(
      (a, b) =>
        b.total - a.total || b.missing - a.missing || b.anomaly - a.anomaly
    );
    return arr;
  }, [issueRows]);

  const summary = useMemo(() => {
    const base = anomalyResult?.summary || {};
    const baseRows = issueRows || [];

    const missingCnt = baseRows.filter((r) => r.status === "issue").length;
    const anomalyCnt = baseRows.filter((r) => r.status === "check").length;

    const totalRows = base.total_rows ?? base.totalRows ?? baseRows.length ?? 0;
    const okRows =
      base.ok_rows ?? Math.max(0, totalRows - missingCnt - anomalyCnt);
    const issueRatio = totalRows ? missingCnt / totalRows : 0;

    return {
      ...base,
      year_month: base.year_month ?? closingKpi?.month ?? "",
      total_rows: totalRows,
      issue_rows: missingCnt,
      anomaly_rows: anomalyCnt,
      ok_rows: okRows,
      reviewed_rows: reviewedRows.length,
      issue_ratio: issueRatio,
    };
  }, [anomalyResult, issueRows, closingKpi, reviewedRows.length]);

  const historyForSelected = useMemo(() => {
    if (!selectedIssue || !historyMap) return [];
    let histKey = selectedIssue.key;
    if (!histKey && selectedIssue.costCenter && selectedIssue.accountCode) {
      histKey = `${selectedIssue.costCenter}|${selectedIssue.accountCode}`;
    }
    if (!histKey) return [];
    return historyMap[histKey] || [];
  }, [selectedIssue, historyMap]);

  const prevMonthInfo = useMemo(() => {
    if (!selectedIssue || !historyForSelected?.length) return null;

    const sorted = [...historyForSelected]
      .map((h) => ({ ...h, month: String(h.month || "") }))
      .filter((h) => h.month)
      .sort((a, b) => a.month.localeCompare(b.month));

    const selMonth = String(selectedIssue.month || "");
    const idx = sorted.findIndex((h) => h.month === selMonth);

    if (idx === -1) {
      if (sorted.length >= 2) {
        const prev = sorted[sorted.length - 2];
        const cur = sorted[sorted.length - 1];
        return {
          prevMonth: prev.month,
          prevAmount: Number(prev.amount || 0),
          curMonth: cur.month,
          curAmount: Number(cur.amount || 0),
        };
      }
      const only = sorted[sorted.length - 1];
      return {
        prevMonth: null,
        prevAmount: null,
        curMonth: only.month,
        curAmount: Number(only.amount || 0),
      };
    }

    const cur = sorted[idx];
    const prev = idx > 0 ? sorted[idx - 1] : null;

    return {
      prevMonth: prev ? prev.month : null,
      prevAmount: prev ? Number(prev.amount || 0) : null,
      curMonth: cur ? cur.month : null,
      curAmount: cur ? Number(cur.amount || 0) : null,
    };
  }, [selectedIssue, historyForSelected]);

  const hasServerBand = historyForSelected.some(
    (h) =>
      (h && h.normalUpper != null && !Number.isNaN(Number(h.normalUpper))) ||
      (h && h.normalLower != null && !Number.isNaN(Number(h.normalLower)))
  );

  const selectedHistoryStats = useMemo(() => {
    if (!selectedIssue && !historyForSelected.length) return null;
    if (hasServerBand) return null;

    const hasServerPattern =
      selectedIssue &&
      selectedIssue.patternMean != null &&
      (selectedIssue.patternUpper != null ||
        selectedIssue.patternLower != null);

    if (hasServerPattern) {
      let mean = selectedIssue.patternMean;
      let upper = selectedIssue.patternUpper;
      let lower = selectedIssue.patternLower;

      if (mean == null && upper != null && lower != null)
        mean = (upper + lower) / 2;
      if (mean != null && upper == null) upper = mean * 1.2;
      if (mean != null && lower == null) lower = mean * 0.8;

      if (mean != null && upper != null && lower != null)
        return { mean, upper, lower };
    }

    if (!historyForSelected.length) return null;

    const amounts = historyForSelected
      .map((h) => Number(h.amount) || 0)
      .filter((v) => !Number.isNaN(v));

    if (!amounts.length) return null;

    const mean = amounts.reduce((acc, v) => acc + v, 0) / (amounts.length || 1);
    return { mean, upper: mean * 1.2, lower: mean * 0.8 };
  }, [selectedIssue, historyForSelected, hasServerBand]);

  const formatAmount = (v) =>
    typeof v === "number" ? v.toLocaleString("ko-KR") : v;

  const tableRows = viewMode === "issues" ? filteredIssueRows : reviewedRows;

  const hasPending = useMemo(
    () => Object.values(pendingMap).some((v) => v),
    [pendingMap]
  );

  useEffect(() => {
    setReviewedMap({});
    setPendingMap({});
    setViewMode("issues");
    setIssueFilter("all");
  }, [anomalyResult, rows]);

  // ✅ 탭/필터/리스트 길이 바뀌어도 스크롤 위치 복원
  useEffect(() => {
    const el = listScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = scrollTopRef.current || 0;
    });
  }, [viewMode, issueFilter, tableRows.length]);

  const stickyTh = {
    position: "sticky",
    top: 0,
    zIndex: 2,
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* 상단 KPI + AI 요약 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 10 }}>
        {/* 좌측 KPI */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: BRAND_DARK,
            }}
          >
            결산 비용 KPI (Closing 기준)
          </div>

          {closingKpi ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {closingKpi.month || ""} 총비용
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginTop: 2,
                    color: BRAND_DARK,
                  }}
                >
                  {closingKpi.currentTotal.toLocaleString("ko-KR")} 원
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  전월 대비 증감
                </div>
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 4 }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: closingKpi.diff >= 0 ? BRAND_ORANGE : BRAND_GREEN,
                    }}
                  >
                    {closingKpi.diff >= 0 ? "+" : ""}
                    {closingKpi.diff.toLocaleString("ko-KR")} 원
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>
                    ({closingKpi.diffRate >= 0 ? "+" : ""}
                    {closingKpi.diffRate.toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  당해 YTD 누계
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    marginTop: 2,
                    color: BRAND_DARK,
                  }}
                >
                  {closingKpi.ytdTotal.toLocaleString("ko-KR")} 원
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  전년 동월 대비
                </div>
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 4 }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color:
                        closingKpi.yoyDiff >= 0 ? BRAND_ORANGE : BRAND_GREEN,
                    }}
                  >
                    {closingKpi.yoyDiff >= 0 ? "+" : ""}
                    {closingKpi.yoyDiff.toLocaleString("ko-KR")} 원
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>
                    ({closingKpi.yoyRate >= 0 ? "+" : ""}
                    {closingKpi.yoyRate.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              월별 비용 데이터가 없어 KPI를 계산할 수 없습니다.
            </div>
          )}
        </div>

        {/* 우측 AI 요약 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: BRAND_DARK,
            }}
          >
            AI Closing 분석 요약 (서버)
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 6,
              fontSize: 10,
            }}
          >
            <div
              style={{
                padding: 6,
                borderRadius: 4,
                backgroundColor: "rgba(59,130,246,0.05)",
                border: "1px solid rgba(59,130,246,0.15)",
              }}
            >
              <div style={{ color: "#1d4ed8", marginBottom: 2 }}>검증 완료</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {summary.reviewed_rows?.toLocaleString("ko-KR")}
              </div>
            </div>

            <div
              style={{
                padding: 6,
                borderRadius: 4,
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ color: "#6b7280", marginBottom: 2 }}>
                검증 대상 건수
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {summary.total_rows?.toLocaleString("ko-KR")}
              </div>
            </div>

            <div
              style={{
                padding: 6,
                borderRadius: 4,
                backgroundColor: "rgba(239,68,68,0.02)",
                border: "1px solid rgba(239,68,68,0.1)",
              }}
            >
              <div style={{ color: "#b91c1c", marginBottom: 2 }}>누락 건수</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {summary.issue_rows?.toLocaleString("ko-KR")}
              </div>
              <div style={{ fontSize: 10, color: "#b91c1c" }}>
                (비중 {(summary.issue_ratio * 100 || 0).toFixed(1)}%)
              </div>
            </div>

            <div
              style={{
                padding: 6,
                borderRadius: 4,
                backgroundColor: "rgba(245,158,11,0.02)",
                border: "1px solid rgba(245,158,11,0.1)",
              }}
            >
              <div style={{ color: "#92400e", marginBottom: 2 }}>이상 건수</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {summary.anomaly_rows?.toLocaleString("ko-KR")}
              </div>
            </div>

            <div
              style={{
                padding: 6,
                borderRadius: 4,
                backgroundColor: "rgba(16,185,129,0.02)",
                border: "1px solid rgba(16,185,129,0.1)",
              }}
            >
              <div style={{ color: "#047857", marginBottom: 2 }}>
                정상 건수(추정)
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {(
                  summary.ok_rows ??
                  summary.total_rows - summary.issue_rows - summary.anomaly_rows
                )?.toLocaleString("ko-KR")}
              </div>
            </div>
          </div>

          {anomalyLoading && (
            <div style={{ marginTop: 4, fontSize: 10, color: "#6b7280" }}>
              백엔드에서 이상/누락 분석을 불러오는 중입니다...
            </div>
          )}
          {anomalyError && (
            <div style={{ marginTop: 4, fontSize: 10, color: "#b91c1c" }}>
              분석 요약 호출 중 오류: {anomalyError}
            </div>
          )}
        </div>
      </div>

      {/* 하단: 리스트 + 추이 */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 10 }}>
        {/* 왼쪽: 이슈 리스트 */}
        <div
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            height: 370,
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: BRAND_DARK }}>
                코스트센터 / 계정별 이슈 리스트
              </div>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => setViewMode("issues")}
                style={{
                  ...tabBaseStyle,
                  ...(viewMode === "issues"
                    ? {
                        backgroundColor: "#111827",
                        borderColor: "#111827",
                        color: "#ffffff",
                      }
                    : {}),
                }}
              >
                이슈
              </button>
              <button
                onClick={() => setViewMode("reviewed")}
                style={{
                  ...tabBaseStyle,
                  ...(viewMode === "reviewed"
                    ? {
                        backgroundColor: "#111827",
                        borderColor: "#111827",
                        color: "#ffffff",
                      }
                    : {}),
                }}
              >
                검증완료
              </button>
            </div>
          </div>

          {viewMode === "issues" && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 4,
                marginBottom: 4,
              }}
            >
              <button
                onClick={() => setIssueFilter("all")}
                style={{
                  ...filterBaseStyle,
                  ...(issueFilter === "all"
                    ? {
                        backgroundColor: "#111827",
                        borderColor: "#111827",
                        color: "#ffffff",
                      }
                    : {}),
                }}
              >
                전체
              </button>
              <button
                onClick={() => setIssueFilter("missing")}
                style={{
                  ...filterBaseStyle,
                  ...(issueFilter === "missing"
                    ? {
                        backgroundColor: "#b91c1c",
                        borderColor: "#b91c1c",
                        color: "#ffffff",
                      }
                    : {}),
                }}
              >
                누락만
              </button>
              <button
                onClick={() => setIssueFilter("anomaly")}
                style={{
                  ...filterBaseStyle,
                  ...(issueFilter === "anomaly"
                    ? {
                        backgroundColor: "#92400e",
                        borderColor: "#92400e",
                        color: "#ffffff",
                      }
                    : {}),
                }}
              >
                이상만
              </button>
            </div>
          )}

          {issueRows.length === 0 ? (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              현재 Closing 기준으로 표시할 이슈가 없습니다.
            </div>
          ) : tableRows.length === 0 ? (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {viewMode === "issues"
                ? "선택한 필터에 해당하는 이슈가 없습니다."
                : "확인 처리된 항목이 없습니다."}
            </div>
          ) : (
            // ✅ 여기가 핵심: ref + onScroll 추가
            <div
              ref={listScrollRef}
              onScroll={() => {
                if (listScrollRef.current) {
                  scrollTopRef.current = listScrollRef.current.scrollTop;
                }
              }}
              style={{ flex: 1, minHeight: 0, overflow: "auto" }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 10,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        textAlign: "left",
                        padding: "4px 6px",
                      }}
                    >
                      상태
                    </th>
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        textAlign: "left",
                        padding: "4px 6px",
                      }}
                    >
                      기준월
                    </th>
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        textAlign: "left",
                        padding: "4px 6px",
                      }}
                    >
                      코스트센터
                    </th>
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        textAlign: "left",
                        padding: "4px 6px",
                      }}
                    >
                      계정코드
                    </th>
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        textAlign: "left",
                        padding: "4px 6px",
                      }}
                    >
                      계정명
                    </th>
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        textAlign: "right",
                        padding: "4px 6px",
                      }}
                    >
                      금액
                    </th>
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        textAlign: "left",
                        padding: "4px 6px",
                      }}
                    >
                      사유(요약)
                    </th>
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        textAlign: "center",
                        padding: "4px 6px",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {viewMode === "issues" ? (
                        <button
                          type="button"
                          onClick={handleConfirmSelected}
                          disabled={!hasPending}
                          title={
                            hasPending
                              ? "체크한 항목을 확인완료로 처리"
                              : "체크된 항목이 없습니다"
                          }
                          style={confirmBtnStyle(hasPending)}
                        >
                          확인
                        </button>
                      ) : (
                        "확인"
                      )}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tableRows.map((r) => {
                    const active = selectedIssue && selectedIssue.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => onIssueRowClick && onIssueRowClick(r)}
                        style={{
                          cursor: "pointer",
                          backgroundColor: active ? "#eff6ff" : "transparent",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        <td style={{ padding: "3px 6px" }}>
                          <StatusBadge status={r.status} />
                        </td>
                        <td style={{ padding: "3px 6px" }}>{r.month}</td>
                        <td style={{ padding: "3px 6px" }}>
                          {r.costCenterName || r.costCenter || "-"}
                        </td>
                        <td style={{ padding: "3px 6px" }}>{r.accountCode}</td>
                        <td style={{ padding: "3px 6px", fontWeight: 500 }}>
                          {r.accountName || "(계정명 없음)"}
                        </td>
                        <td style={{ padding: "3px 6px", textAlign: "right" }}>
                          {Math.round(r.amount || 0).toLocaleString("ko-KR")}
                        </td>

                        <td
                          style={{
                            padding: "3px 6px",
                            maxWidth: 180,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontSize: 10,
                          }}
                          title={r.reasonFull || ""}
                        >
                          {r.reasonSummary || "-"}
                        </td>

                        <td
                          style={{ padding: "3px 6px", textAlign: "center" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {viewMode === "issues" ? (
                            <input
                              type="checkbox"
                              checked={!!r.pending}
                              onChange={() => handleTogglePending(r)}
                            />
                          ) : r.reviewed ? (
                            <button
                              type="button"
                              onClick={() => handleUndoReview(r)}
                              style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 999,
                                border: "1px solid #d1d5db",
                                backgroundColor: "#ffffff",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              취소
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 오른쪽: 선택 이슈 추이 */}
        <div
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            height: 370,
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: BRAND_DARK,
            }}
          >
            선택 이슈 추이
          </div>

          {!selectedIssue ? (
            <div
              style={{
                fontSize: 11,
                color: "#9ca3af",
                flex: 1,
                display: "flex",
                alignItems: "center",
              }}
            >
              왼쪽 이슈 리스트에서 항목을 클릭하면, 해당 계정/코스트센터의 월별
              추이를 확인할 수 있습니다.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                {/* 좌측: 계정/코스트센터 */}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: "16px",
                    }}
                  >
                    {selectedIssue.accountName || "(계정명 없음)"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      lineHeight: "14px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 220,
                    }}
                    title={`${selectedIssue.accountCode} · ${
                      selectedIssue.costCenterName ||
                      selectedIssue.costCenter ||
                      "-"
                    }`}
                  >
                    {selectedIssue.accountCode} ·{" "}
                    {selectedIssue.costCenterName ||
                      selectedIssue.costCenter ||
                      "-"}
                  </div>
                </div>

                {/* 우측: 상태/기준월 (요청대로 오른쪽에) */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 2,
                    whiteSpace: "nowrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      lineHeight: "14px",
                    }}
                  >
                    상태 <StatusBadge status={selectedIssue.status} />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      lineHeight: "14px",
                    }}
                  >
                    기준월 {selectedIssue.month}
                  </div>
                </div>
              </div>

              {/* 상세 사유(원문) - 너무 길면 차트 비중 먹어서 높이 제한 */}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                  backgroundColor: "#f9fafb",
                  marginBottom: 8,
                  overflow: "auto",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  사유(상세)
                </div>

                {selectedIssue.reasonTags &&
                  selectedIssue.reasonTags.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        marginBottom: 6,
                      }}
                    >
                      {selectedIssue.reasonTags.map((tag, idx) => (
                        <span
                          key={`${tag}-${idx}`}
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 999,
                            border: "1px solid #d1d5db",
                            background: "#f3f4f6",
                            color: "#374151",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                <div
                  style={{
                    fontSize: 10,
                    color: "#4b5563",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedIssue.reasonFull || "-"}
                </div>
              </div>

              {historyForSelected.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: 8,
                    minHeight: 0,
                  }}
                >
                  {/* ✅ 차트 크게 */}
                  <div
                    style={{
                      height: 230, // ✅ 135 -> 230
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                      padding: "6px 8px 0 0",
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historyForSelected}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 10 }}
                          padding={{ left: 6, right: 6 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={formatAmount}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            formatAmount(value),
                            name === "amount"
                              ? "실제 금액"
                              : name === "normalUpper"
                              ? "상한선(서버)"
                              : name === "normalLower"
                              ? "하한선(서버)"
                              : name,
                          ]}
                          labelFormatter={(label) => `${label} 월`}
                        />

                        {selectedIssue?.month && (
                          <ReferenceLine
                            x={selectedIssue.month}
                            stroke="#6366f1"
                            strokeDasharray="3 3"
                          />
                        )}

                        {selectedHistoryStats && (
                          <>
                            <ReferenceLine
                              y={selectedHistoryStats.mean}
                              stroke="#9ca3af"
                              strokeDasharray="3 3"
                            />
                            <ReferenceLine
                              y={selectedHistoryStats.upper}
                              stroke="#f97316"
                              strokeDasharray="4 4"
                            />
                            <ReferenceLine
                              y={selectedHistoryStats.lower}
                              stroke="#22c55e"
                              strokeDasharray="4 4"
                            />
                          </>
                        )}

                        {hasServerBand && (
                          <>
                            <Line
                              type="monotone"
                              dataKey="normalUpper"
                              stroke="#f97316"
                              strokeWidth={1}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="normalLower"
                              stroke="#22c55e"
                              strokeWidth={1}
                              dot={false}
                            />
                          </>
                        )}

                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  선택한 항목의 월별 히스토리가 없습니다.
                </div>
              )}
            </>
          )}
          {/* 전월/선택월 금액 (컴팩트 바) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              backgroundColor: "#ffffff",
              marginTop: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 10, color: "#6b7280" }}>전월</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: BRAND_DARK }}>
                {prevMonthInfo?.prevAmount == null
                  ? "-"
                  : Math.round(prevMonthInfo.prevAmount).toLocaleString(
                      "ko-KR"
                    )}
                {prevMonthInfo?.prevAmount == null ? "" : " 원"}
                <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 6 }}>
                  {prevMonthInfo?.prevMonth ? prevMonthInfo.prevMonth : ""}
                </span>
              </div>
            </div>

            <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 10, color: "#6b7280" }}>선택월</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: BRAND_DARK }}>
                {prevMonthInfo?.curAmount == null
                  ? "-"
                  : Math.round(prevMonthInfo.curAmount).toLocaleString("ko-KR")}
                {prevMonthInfo?.curAmount == null ? "" : " 원"}
                <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 6 }}>
                  {prevMonthInfo?.curMonth ? prevMonthInfo.curMonth : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 코스트센터별 이슈 요약 */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: BRAND_DARK,
          }}
        >
          코스트센터별 이슈 요약 (미확인 기준)
        </div>

        {ccIssueSummary.length === 0 ? (
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            요약할 이슈가 없습니다.
          </div>
        ) : (
          <div
            style={{
              maxHeight: 140,
              overflow: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th
                    style={{
                      ...stickyTh,
                      textAlign: "left",
                      padding: "6px 8px",
                    }}
                  >
                    코스트센터
                  </th>
                  <th
                    style={{
                      ...stickyTh,
                      textAlign: "right",
                      padding: "6px 8px",
                    }}
                  >
                    총 이슈
                  </th>
                  <th
                    style={{
                      ...stickyTh,
                      textAlign: "right",
                      padding: "6px 8px",
                    }}
                  >
                    누락
                  </th>
                  <th
                    style={{
                      ...stickyTh,
                      textAlign: "right",
                      padding: "6px 8px",
                    }}
                  >
                    이상
                  </th>
                </tr>
              </thead>
              <tbody>
                {ccIssueSummary.map((r) => (
                  <tr key={r.cc} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                      {r.cc}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {r.total.toLocaleString("ko-KR")}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        color: "#b91c1c",
                        fontWeight: 700,
                      }}
                    >
                      {r.missing.toLocaleString("ko-KR")}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        color: "#92400e",
                        fontWeight: 700,
                      }}
                    >
                      {r.anomaly.toLocaleString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
