// src/components/tabs/ClosingTab.js
import React, { useMemo, useState, useEffect } from "react";
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

// 상태 뱃지
const StatusBadge = ({ status }) => {
  let bg = "#e5e7eb";
  let txt = "#374151";
  let label = "확인";

  if (status === "issue") {
    // 누락
    bg = "rgba(239, 68, 68, 0.08)";
    txt = "#b91c1c";
    label = "누락";
  } else if (status === "check") {
    // 이상
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
  // 프론트에서 계산한 기본 rows
  const rows = closingAnalysis?.rows || [];

  // 백엔드 결과 존재 여부
  const hasBackend = !!(anomalyResult && anomalyResult.summary);

  // 필터 상태: all / missing / anomaly (이슈 뷰용)
  const [issueFilter, setIssueFilter] = useState("all");

  // 🔹 이슈/확인완료 뷰 전환용 내부 탭 상태
  //   "issues"  : 전체 이슈 리스트
  //   "reviewed": 확인 처리된 목록만
  const [viewMode, setViewMode] = useState("issues");

  // ✅ 사람이 "확인 처리 완료"한 행
  const [reviewedMap, setReviewedMap] = useState({});

  // ✅ 체크박스로 임시 선택만 한 상태 (버튼 누르기 전)
  const [pendingMap, setPendingMap] = useState({});

  const buildRowKey = (r) =>
    `${r.costCenter || ""}|${r.accountCode || ""}|${r.month || ""}`;

  // 체크박스 토글 (선택만, 아직 확정 아님)
  const handleTogglePending = (row) => {
    const key = row.rowKey || buildRowKey(row);
    setPendingMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 선택 항목들을 "확인 처리"로 확정
  const handleConfirmSelected = () => {
    setReviewedMap((prevReviewed) => {
      const updated = { ...prevReviewed };
      Object.entries(pendingMap).forEach(([key, val]) => {
        if (val) {
          updated[key] = true;
        }
      });
      return updated;
    });
    // 선택 상태 초기화
    setPendingMap({});
  };

  // ✅ 확인완료 탭에서 되돌리기(해제)
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

  // 필터 버튼 공통 스타일
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

  // 내부 탭 버튼 스타일
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

  // ==========================
  // 히스토리 맵 (백엔드 우선)
  // ==========================
  const historyMap = useMemo(() => {
    if (hasBackend && anomalyResult.history) {
      return anomalyResult.history;
    }
    return closingAnalysis?.history || {};
  }, [hasBackend, anomalyResult, closingAnalysis]);

  // ==========================
  // 이슈 리스트 rows (백엔드 issues 우선)
  //  - status: AI 기준 상태
  //  - reviewed: 사람이 확인 처리 완료 여부
  // ==========================
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

      if (issueType === "결측 의심") {
        status = "issue";
      } else if (issueType === "정상") {
        status = "ok";
      } else if (issueType === "이상치 의심") {
        status = "check";
      }

      if (amountNum === 0 || amountNum === null) {
        status = "issue";
      }

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

      const reason = r.reason_kor || r.reason || "";

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
        reason,
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

    // 백엔드 있으면 이슈(누락/이상)만 대상
    if (hasBackend) {
      mapped = mapped.filter(
        (r) => r.status === "issue" || r.status === "check"
      );
    }

    return mapped;
  }, [hasBackend, anomalyResult, rows, reviewedMap, pendingMap]);

  // ==========================
  // 필터 + 정렬 적용된 rows (이슈 뷰용)
  //  → 사람이 확인 완료한 reviewed 행은 제외해서 이슈탭에서 안 보이게
  // ==========================
  const filteredIssueRows = useMemo(() => {
    if (!issueRows.length) return [];

    // 먼저 reviewed(확인완료) 아닌 것만 남김
    let tmp = issueRows.filter((r) => !r.reviewed);

    if (issueFilter === "missing") {
      tmp = tmp.filter((r) => r.status === "issue");
    } else if (issueFilter === "anomaly") {
      tmp = tmp.filter((r) => r.status === "check");
    }

    const rank = {
      issue: 0,
      check: 1,
      ok: 2,
      other: 3,
    };

    return [...tmp].sort((a, b) => {
      const ra = rank[a.status] ?? 3;
      const rb = rank[b.status] ?? 3;
      if (ra !== rb) return ra - rb;
      return 0;
    });
  }, [issueRows, issueFilter]);

  // ✅ 확인 완료 목록 (뷰 "확인완료" 탭에서 사용)
  const reviewedRows = useMemo(
    () => issueRows.filter((r) => r.reviewed),
    [issueRows]
  );

  // ==========================
  // 상단 summary (서버 summary + 화면 issueRows를 "연동")
  // ==========================
  const summary = useMemo(() => {
    const base = anomalyResult?.summary || {};

    // 화면에 존재하는 rows 기준(백엔드 있으면 issue/check만 남아있음)
    const baseRows = issueRows || [];

    const missingCnt = baseRows.filter((r) => r.status === "issue").length;
    const anomalyCnt = baseRows.filter((r) => r.status === "check").length;

    // total_rows는 "서버가 준 값"이 있으면 그걸 우선(정상 포함한 전체 검증대상)
    // 없으면 현재 rows 길이로 대체
    const totalRows = base.total_rows ?? base.totalRows ?? baseRows.length ?? 0;

    // ok_rows는 서버가 주면 존중하되, 없으면 total - (missing+anomaly)로 추정
    const okRows =
      base.ok_rows ?? Math.max(0, totalRows - missingCnt - anomalyCnt);

    const issueRatio = totalRows ? missingCnt / totalRows : 0;

    return {
      ...base,
      year_month: base.year_month ?? closingKpi?.month ?? "",
      total_rows: totalRows,
      issue_rows: missingCnt, // ✅ 화면과 연동
      anomaly_rows: anomalyCnt, // ✅ 화면과 연동
      ok_rows: okRows, // ✅ 연동
      reviewed_rows: reviewedRows.length, // ✅ 추가,
      issue_ratio: issueRatio, // ✅ 연동
    };
  }, [anomalyResult, issueRows, closingKpi]);

  // ==========================
  // 선택된 이슈의 추이 데이터
  // ==========================
  const historyForSelected = useMemo(() => {
    if (!selectedIssue || !historyMap) return [];

    let histKey = selectedIssue.key;

    if (!histKey && selectedIssue.costCenter && selectedIssue.accountCode) {
      histKey = `${selectedIssue.costCenter}|${selectedIssue.accountCode}`;
    }

    if (!histKey) return [];
    return historyMap[histKey] || [];
  }, [selectedIssue, historyMap]);

  // 백엔드에서 월별 상·하한선(normalUpper / normalLower)을 주는지 여부
  const hasServerBand = historyForSelected.some(
    (h) =>
      (h &&
        h.normalUpper !== null &&
        h.normalUpper !== undefined &&
        !Number.isNaN(Number(h.normalUpper))) ||
      (h.normalLower !== null &&
        h.normalLower !== undefined &&
        !Number.isNaN(Number(h.normalLower)))
  );

  // 선택 이슈 추이용 패턴 통계
  const selectedHistoryStats = useMemo(() => {
    if (!selectedIssue && !historyForSelected.length) return null;

    if (hasServerBand) {
      return null;
    }

    const hasServerPattern =
      selectedIssue &&
      selectedIssue.patternMean !== null &&
      selectedIssue.patternMean !== undefined &&
      (selectedIssue.patternUpper !== null ||
        selectedIssue.patternLower !== null);

    if (hasServerPattern) {
      let mean = selectedIssue.patternMean;
      let upper = selectedIssue.patternUpper;
      let lower = selectedIssue.patternLower;

      if (mean == null && upper != null && lower != null) {
        mean = (upper + lower) / 2;
      }
      if (mean != null && upper == null) {
        upper = mean * 1.2;
      }
      if (mean != null && lower == null) {
        lower = mean * 0.8;
      }

      if (mean != null && upper != null && lower != null) {
        return { mean, upper, lower };
      }
    }

    if (!historyForSelected.length) return null;

    const amounts = historyForSelected
      .map((h) => Number(h.amount) || 0)
      .filter((v) => !Number.isNaN(v));

    if (!amounts.length) return null;

    const mean = amounts.reduce((acc, v) => acc + v, 0) / (amounts.length || 1);
    const upper = mean * 1.2;
    const lower = mean * 0.8;

    return {
      mean,
      upper,
      lower,
    };
  }, [selectedIssue, historyForSelected, hasServerBand]);

  // ==========================
  // 코스트센터별 이슈 요약
  // ==========================
  const centerSummary = useMemo(() => {
    // 1) 백엔드에서 centers를 준 경우 그걸 우선 사용
    if (hasBackend && Array.isArray(anomalyResult.centers)) {
      return anomalyResult.centers
        .map((c) => {
          const costCenter = c.cost_center || "-";
          const costCenterName = c.cc_name || costCenter || "-";

          const totalRows = c.total_rows || 0;
          const issueRows = c.issue_rows || 0; // 누락+이상 합
          const missingRows = c.missing_rows || 0;
          const anomalyRows = c.anomaly_rows || 0;
          const totalAmount = c.total_amount || 0;
          const issueRatio =
            totalRows > 0 ? issueRows / totalRows : c.issue_ratio || 0;

          return {
            costCenter,
            costCenterName,
            totalRows,
            issueRows,
            missingRows,
            anomalyRows,
            totalAmount,
            issueRatio,
          };
        })
        .filter((c) => c.issueRows > 0)
        .sort((a, b) => {
          // 이슈 건수 기준 내림차순, 동률이면 금액 큰 순
          if (b.issueRows !== a.issueRows) return b.issueRows - a.issueRows;
          return Math.abs(b.totalAmount) - Math.abs(a.totalAmount);
        });
    }

    // 2) 백엔드 centers 없으면 issueRows를 직접 집계
    if (!issueRows.length) return [];

    const map = {};

    issueRows.forEach((r) => {
      const code = r.costCenter || "-";
      const name = r.costCenterName || code || "-";

      const key = `${code}|${name}`;
      if (!map[key]) {
        map[key] = {
          costCenter: code,
          costCenterName: name,
          totalRows: 0,
          issueRows: 0,
          missingRows: 0,
          anomalyRows: 0,
          totalAmount: 0,
        };
      }

      const item = map[key];
      item.totalRows += 1;
      item.totalAmount += r.amount || 0;

      // 누락/이상 개수 카운트
      if (r.status === "issue") {
        item.missingRows += 1;
        item.issueRows += 1;
      } else if (r.status === "check") {
        item.anomalyRows += 1;
        item.issueRows += 1;
      }
    });

    return Object.values(map)
      .filter((item) => item.issueRows > 0)
      .map((item) => ({
        ...item,
        issueRatio: item.totalRows ? item.issueRows / item.totalRows : 0,
      }))
      .sort((a, b) => {
        if (b.issueRows !== a.issueRows) return b.issueRows - a.issueRows;
        return Math.abs(b.totalAmount) - Math.abs(a.totalAmount);
      });
  }, [hasBackend, anomalyResult, issueRows]);

  const formatAmount = (v) =>
    typeof v === "number" ? v.toLocaleString("ko-KR") : v;

  // 현재 왼쪽 테이블에 실제로 보여줄 rows
  const tableRows = viewMode === "issues" ? filteredIssueRows : reviewedRows;

  const hasPending = useMemo(
    () => Object.values(pendingMap).some((v) => v),
    [pendingMap]
  );

  useEffect(() => {
    // 데이터 소스가 바뀌면(업로드/재분석) 사람 체크 상태 초기화
    setReviewedMap({});
    setPendingMap({});
    setViewMode("issues");
    setIssueFilter("all");
  }, [anomalyResult, rows]);

  // ==========================
  // 렌더
  // ==========================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* 상단 KPI + AI 요약 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 10 }}>
        {/* 좌측: 결산 KPI */}
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

        {/* 우측: AI Closing 분석 요약 (서버) */}
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

      {/* 하단: 코스트센터 / 계정별 이슈 리스트 + 상세 추이 */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 10 }}>
        {/* 왼쪽: 이슈 리스트 + 확인완료 탭 */}
        <div
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            height: 370,
            minHeight: 0,
          }}
        >
          {/* 제목 + 내부 탭 버튼 */}
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

          {/* 이슈 뷰일 때만 필터 버튼 노출 */}
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
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
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
                        textAlign: "left",
                        padding: "4px 6px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      상태
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 6px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      기준월
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 6px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      코스트센터
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 6px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      계정코드
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 6px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      계정명
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "4px 6px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      금액
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 6px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      사유
                    </th>

                    <th
                      style={{
                        textAlign: "center",
                        padding: "4px 6px",
                        borderBottom: "1px solid #e5e7eb",
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
                          title={r.reason || ""}
                        >
                          {r.reason || "-"}
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
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {selectedIssue.accountName || "(계정명 없음)"}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {selectedIssue.accountCode} ·{" "}
                  {selectedIssue.costCenterName ||
                    selectedIssue.costCenter ||
                    "-"}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  상태: <StatusBadge status={selectedIssue.status} /> · 기준월{" "}
                  {selectedIssue.month}
                </div>
              </div>

              {/* 사유 카드 */}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  padding: 6,
                  backgroundColor: "#f9fafb",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                  사유
                </div>

                {selectedIssue.reasonTags &&
                  selectedIssue.reasonTags.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        marginBottom: 3,
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
                  {selectedIssue.reason || "-"}
                </div>
              </div>

              {historyForSelected.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: 6,
                    minHeight: 0,
                  }}
                >
                  {/* 그래프 */}
                  <div
                    style={{
                      height: 110,
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                      padding: "4px 6px 0 0",
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historyForSelected}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 9 }}
                          padding={{ left: 5, right: 5 }}
                        />
                        <YAxis
                          tick={{ fontSize: 9 }}
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

                        {/* 기준월 수직선 */}
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

                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                          name="실제 금액"
                        />

                        {hasServerBand && (
                          <>
                            <Line
                              type="monotone"
                              dataKey="normalUpper"
                              stroke="#f97316"
                              strokeWidth={1}
                              dot={false}
                              strokeDasharray="4 4"
                              name="상한선(서버)"
                            />
                            <Line
                              type="monotone"
                              dataKey="normalLower"
                              stroke="#22c55e"
                              strokeWidth={1}
                              dot={false}
                              strokeDasharray="4 4"
                              name="하한선(서버)"
                            />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 월별 금액 리스트 */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: "auto",
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 4,
                      fontSize: 10,
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
                              textAlign: "left",
                              padding: "4px 6px",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            월
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "4px 6px",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            금액
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...historyForSelected]
                          .slice()
                          .reverse()
                          .map((h, idx) => (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                backgroundColor:
                                  h.month === selectedIssue.month
                                    ? "#eff6ff"
                                    : "transparent",
                              }}
                            >
                              <td style={{ padding: "3px 6px" }}>{h.month}</td>
                              <td
                                style={{
                                  padding: "3px 6px",
                                  textAlign: "right",
                                }}
                              >
                                {Math.round(h.amount || 0).toLocaleString(
                                  "ko-KR"
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  추이 데이터가 없습니다.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 코스트센터별 이슈 요약 카드 */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: BRAND_DARK,
          }}
        >
          코스트센터별 이슈 요약
        </div>

        {centerSummary.length === 0 ? (
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            코스트센터별로 요약할 이슈가 없습니다.
          </div>
        ) : (
          <div style={{ maxHeight: 230, overflowY: "auto" }}>
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
                      textAlign: "left",
                      padding: "4px 6px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    코스트센터 코드
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "4px 6px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    코스트센터명
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "4px 6px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    전체 건수
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "4px 6px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    이슈 건수
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "4px 6px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    누락의심
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "4px 6px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    의심치
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "4px 6px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    이슈 비중
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "4px 6px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    당월 금액합계
                  </th>
                </tr>
              </thead>
              <tbody>
                {centerSummary.map((c, idx) => (
                  <tr
                    key={`${c.costCenter || ""}-${idx}`}
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <td
                      style={{
                        padding: "3px 6px",
                        textAlign: "left",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {c.costCenter || "-"}
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "left" }}>
                      {c.costCenterName || "-"}
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "right" }}>
                      {c.totalRows.toLocaleString("ko-KR")}
                    </td>
                    <td
                      style={{
                        padding: "3px 6px",
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {c.issueRows.toLocaleString("ko-KR")}
                    </td>
                    <td
                      style={{
                        padding: "3px 6px",
                        textAlign: "right",
                        color: "#b91c1c",
                        fontWeight: 600,
                      }}
                    >
                      {c.missingRows.toLocaleString("ko-KR")}
                    </td>
                    <td
                      style={{
                        padding: "3px 6px",
                        textAlign: "right",
                        color: "#92400e",
                        fontWeight: 600,
                      }}
                    >
                      {c.anomalyRows.toLocaleString("ko-KR")}
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "right" }}>
                      {(c.issueRatio * 100).toFixed(1)}% (
                      {c.issueRows.toLocaleString("ko-KR")}/
                      {c.totalRows.toLocaleString("ko-KR")})
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "right" }}>
                      {formatAmount(c.totalAmount)} 원
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
