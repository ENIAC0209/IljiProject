// src/components/tabs/OverviewTab.js
// 전체 경영현황 대시보드 (요약 탭)
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BRAND_DARK } from "../../config/plConfig";

// === 원래 쓰던 색상 팔레트 그대로 ===
const COLOR_PRIMARY = "#2563EB"; // 진한 블루
const COLOR_SECONDARY = "#0EA5E9"; // 스카이 블루
const COLOR_TERTIARY = "#14B8A6"; // 티얼
const COLOR_ACCENT = "#FB7185"; // 핑크 포인트
const COLOR_MUTED = "#9CA3AF";

const PIE_COLORS = [
  "#2563EB",
  "#0EA5E9",
  "#14B8A6",
  "#6366F1",
  "#F97373",
  "#FBBF24",
];

const fmt = (v) =>
  typeof v === "number" ? v.toLocaleString("ko-KR") : v ?? "-";

// 긴 reason 한 줄 요약용 헬퍼
function makeShortReason(reason, maxLen = 80) {
  if (!reason) return "";
  const s = String(reason).trim();

  // 마침표 기준으로 첫 문장만 가져오기
  const firstSentence = s.split(/(?<=\.)/)[0].trim() || s;

  if (firstSentence.length <= maxLen) return firstSentence;
  return firstSentence.slice(0, maxLen) + "…";
}

export function OverviewTab({
  kpi,
  monthlyTotalCost,
  selectedMonth,
  accountGroupShare,
  topCostCenters, // (지금은 안 쓰지만 props 유지)
  closingAnalysis,
  anomalyResult, // (지금은 안 쓰지만 props 유지)
  varianceSummary,
  varianceData,
  cardStyle,
}) {
  const kpiNumberStyle = {
    fontSize: 22,
    fontWeight: 700,
  };

  // 최근 12개월 추이
  const lineChartData =
    monthlyTotalCost && monthlyTotalCost.length > 12
      ? monthlyTotalCost.slice(-12)
      : monthlyTotalCost || [];

  // Closing 이슈 요약
  const closingRows = closingAnalysis?.rows || [];
  const totalIssues = closingRows.length;
  const criticalIssues = closingRows.filter((r) => r.status === "issue").length;
  const checkIssues = closingRows.filter((r) => r.status === "check").length;

  // 화면에 보여줄 Top5 (status issue/check 우선, reason은 짧게 가공)
  const closingTop = closingRows
    .filter((r) => r.status === "issue" || r.status === "check")
    .slice(0, 5)
    .map((r) => ({
      ...r,
      shortReason: makeShortReason(r.reason || r.explanation || ""),
    }));

  // Variance Top 5
  const varianceTop = (varianceData || []).slice(0, 5);

  // 계정군 총합
  const totalGroupAmount = (accountGroupShare || []).reduce(
    (acc, x) => acc + (x.value || 0),
    0
  );

  const hasAccountGroup =
    Array.isArray(accountGroupShare) && accountGroupShare.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ========== 상단 : 결산 한눈에 보기 (2×2 카드, 안 찌그러지게) ========== */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "2.1fr 1.9fr",
          gap: 12,
        }}
      >
        {/* 왼쪽 : KPI 4개 */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: BRAND_DARK,
              }}
            >
              결산 한눈에 보기
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              분석월:{" "}
              {selectedMonth ||
                monthlyTotalCost[monthlyTotalCost.length - 1]?.month ||
                "-"}
            </div>
          </div>

          {/* 2×2 레이아웃로 넉넉하게 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              gap: 10,
            }}
          >
            {/* 선택 월 총비용 */}
            <div
              style={{
                padding: 8,
                borderLeft: `3px solid ${COLOR_PRIMARY}`,
              }}
            >
              <div
                style={{ fontSize: 11, color: COLOR_MUTED, marginBottom: 2 }}
              >
                선택 월 총비용
              </div>
              <div style={{ ...kpiNumberStyle, color: COLOR_PRIMARY }}>
                {fmt(kpi.currentTotal)}억
              </div>
              <div
                style={{
                  fontSize: 11,
                  marginTop: 2,
                  color: kpi.diff >= 0 ? "#EF4444" : "#16A34A",
                  fontWeight: 500,
                }}
              >
                {kpi.diff >= 0 ? "▲" : "▼"} {kpi.diffRate.toFixed(1)}% (전월)
              </div>
            </div>

            {/* 연간 누적 총비용 */}
            <div
              style={{
                padding: 8,
                borderLeft: `3px solid ${COLOR_SECONDARY}`,
              }}
            >
              <div
                style={{ fontSize: 11, color: COLOR_MUTED, marginBottom: 2 }}
              >
                연간 누적 총비용
              </div>
              <div style={{ ...kpiNumberStyle, color: COLOR_SECONDARY }}>
                {fmt(kpi.ytdTotal)}억
              </div>
              <div style={{ fontSize: 11, color: COLOR_MUTED, marginTop: 2 }}>
                기준: {monthlyTotalCost[0]?.month} ~ {selectedMonth}
              </div>
            </div>

            {/* 전년 동월 대비 */}
            <div
              style={{
                padding: 8,
                borderLeft: `3px solid ${COLOR_TERTIARY}`,
              }}
            >
              <div
                style={{ fontSize: 11, color: COLOR_MUTED, marginBottom: 2 }}
              >
                전년 동월 대비
              </div>
              <div
                style={{
                  ...kpiNumberStyle,
                  color: kpi.yoyRate >= 0 ? "#EF4444" : "#16A34A",
                }}
              >
                {kpi.yoyRate >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(kpi.yoyRate).toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: COLOR_MUTED, marginTop: 2 }}>
                YoY {fmt(kpi.yoyDiff)}억
              </div>
            </div>

            {/* Closing 이슈 건수 */}
            <div
              style={{
                padding: 8,
                borderLeft: `3px solid ${COLOR_ACCENT}`,
              }}
            >
              <div
                style={{ fontSize: 11, color: COLOR_MUTED, marginBottom: 2 }}
              >
                Closing 이슈 요약
              </div>
              <div style={{ ...kpiNumberStyle, color: COLOR_ACCENT }}>
                {totalIssues}건
              </div>
              <div style={{ fontSize: 11, color: COLOR_MUTED, marginTop: 2 }}>
                심각 이슈 {criticalIssues}건 / 점검 {checkIssues}건
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 : 설명 요약 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: BRAND_DARK,
              marginBottom: 6,
            }}
          >
            AI 결산 상태 요약
          </div>
          <div
            style={{
              fontSize: 11,
              color: COLOR_MUTED,
              lineHeight: 1.6,
            }}
          >
            · <b style={{ color: BRAND_DARK }}>Closing Check</b>:{" "}
            {totalIssues === 0
              ? "현재 탐지된 이상/누락 이슈가 없습니다."
              : `이상·누락 의심 이슈 ${totalIssues}건이 탐지되었습니다.`}
            <br />· <b style={{ color: BRAND_DARK }}>Variance</b>: 전월 대비
            변동이 큰 계정 위주로 상위 항목을 집계했습니다. Variance 탭에서 세부
            구조를 확인할 수 있습니다.
            <br />· <b style={{ color: BRAND_DARK }}>P&L Report</b>: 손익계산서
            기준으로 계정별 실적과 기여도를 확인할 수 있습니다.
          </div>
        </div>
      </section>

      {/* ========== 중간 : 월별 추이 + 전월 대비 Top 계정 ========== */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "2.1fr 1.9fr",
          gap: 12,
        }}
      >
        {/* 월별 총비용 추이 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: BRAND_DARK,
              marginBottom: 6,
            }}
          >
            월별 총비용 추이 (당해 vs 전년 동월)
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="당해"
                  stroke={COLOR_PRIMARY}
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="lastYear"
                  name="전년 동월"
                  stroke="#CBD5E1"
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 전월 대비 변동 Top 5 계정 (리스트 형태) */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: BRAND_DARK,
              marginBottom: 6,
            }}
          >
            전월 대비 변동이 큰 계정 Top 5
          </div>
          <div
            style={{
              fontSize: 11,
              color: COLOR_MUTED,
              marginBottom: 4,
            }}
          >
            Variance 탭에서 상세 구조를 확인할 수 있습니다.
          </div>
          <div
            style={{
              borderTop: "1px solid #E5E7EB",
              marginTop: 4,
              paddingTop: 4,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {varianceTop.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: COLOR_MUTED,
                  paddingTop: 8,
                }}
              >
                변동 데이터가 없습니다.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                }}
              >
                <thead>
                  <tr
                    style={{
                      color: "#6B7280",
                      textAlign: "left",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <th style={{ padding: "4px 2px" }}>계정</th>
                    <th style={{ padding: "4px 2px", textAlign: "right" }}>
                      전월
                    </th>
                    <th style={{ padding: "4px 2px", textAlign: "right" }}>
                      당월
                    </th>
                    <th style={{ padding: "4px 2px", textAlign: "right" }}>
                      증감(%)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {varianceTop.map((row, idx) => {
                    const diffColor = row.diff >= 0 ? "#EF4444" : "#16A34A";
                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #F3F4F6",
                        }}
                      >
                        <td style={{ padding: "4px 2px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              maxWidth: 130,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {row.accountName}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "4px 2px",
                            textAlign: "right",
                            color: COLOR_MUTED,
                          }}
                        >
                          {fmt(Math.round(row.lastMonth))}
                        </td>
                        <td
                          style={{
                            padding: "4px 2px",
                            textAlign: "right",
                          }}
                        >
                          {fmt(Math.round(row.thisMonth))}
                        </td>
                        <td
                          style={{
                            padding: "4px 2px",
                            textAlign: "right",
                            color: diffColor,
                          }}
                        >
                          {row.rate >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(row.rate).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* ========== 하단 : 계정군 비중 + Closing 이슈 Top ========== */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 2.5fr",
          gap: 12,
        }}
      >
        {/* 계정군별 비용 비중 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: BRAND_DARK,
              marginBottom: 6,
            }}
          >
            계정군별 비용 비중
          </div>

          {hasAccountGroup ? (
            <>
              <div style={{ width: "100%", height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={accountGroupShare}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={2}
                    >
                      {accountGroupShare.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip
                      formatter={(value) => fmt(Math.round(value))}
                      labelFormatter={(label) => label}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: COLOR_MUTED,
                  marginTop: 4,
                }}
              >
                총 {fmt(Math.round(totalGroupAmount))}억 기준으로
                제조원가·판관비·연구개발비 등 비용 구조를 한눈에 볼 수 있습니다.
              </div>
            </>
          ) : (
            <div
              style={{
                fontSize: 11,
                color: COLOR_MUTED,
                marginTop: 8,
              }}
            >
              P&L 데이터가 없어 계정군별 비중을 계산할 수 없습니다. 결산보고서
              파일을 업로드하면 자동으로 채워집니다.
            </div>
          )}
        </div>

        {/* Closing 이슈 Top 5 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: BRAND_DARK,
              marginBottom: 6,
            }}
          >
            Closing 이슈 Top 5
          </div>

          <div
            style={{
              maxHeight: 180,
              overflowY: "auto",
              borderTop: "1px solid #E5E7EB",
              marginTop: 4,
              paddingTop: 4,
              fontSize: 11,
            }}
          >
            {closingTop.length === 0 ? (
              <div style={{ color: COLOR_MUTED, paddingTop: 8 }}>
                현재 탐지된 이상/누락 이슈가 없습니다.
              </div>
            ) : (
              closingTop.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <div style={{ maxWidth: "60%" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: BRAND_DARK,
                        marginBottom: 1,
                      }}
                    >
                      {row.accountName}
                    </div>
                    <div
                      style={{
                        color: COLOR_MUTED,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {row.costCenter} · {row.shortReason}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color:
                          row.status === "issue"
                            ? COLOR_ACCENT
                            : row.status === "check"
                            ? COLOR_PRIMARY
                            : COLOR_MUTED,
                      }}
                    >
                      {fmt(Math.round(row.amount))}
                    </div>
                    <div style={{ color: COLOR_MUTED }}>{row.month}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              fontSize: 11,
              color: COLOR_MUTED,
              lineHeight: 1.6,
              marginTop: 6,
            }}
          >
            · 상세 이슈 흐름과 과거 패턴은{" "}
            <span style={{ fontWeight: 600 }}>Closing Check 탭</span>에서 계정별
            타임라인으로 확인할 수 있습니다.
            <br />· 이 변동이 실제 경영 이벤트인지, 입력 오류/누락인지{" "}
            <span style={{ fontWeight: 600 }}>결산 마감 전</span> 검토가
            필요합니다.
          </div>
        </div>
      </section>
    </div>
  );
}

export default OverviewTab;
