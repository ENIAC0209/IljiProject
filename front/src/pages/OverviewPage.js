// src/pages/OverviewPage.js
import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

function OverviewPage({
  kpi,
  monthlyTotalCost,
  selectedMonth,
  setSelectedMonth,
  costMonthMeta,
  accountGroupShare,
  topCostCenters,
  BRAND_GREEN,
  BRAND_ORANGE,
  PIE_COLORS,
  cardStyle,
}) {
  const kpiNumberStyle = {
    fontSize: 26,
    fontWeight: 700,
  };

  // ✅ 라인 차트용 데이터: 최근 12개월만 사용
  const lineChartData =
    monthlyTotalCost && monthlyTotalCost.length > 12
      ? monthlyTotalCost.slice(-12)
      : monthlyTotalCost || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI 카드들 */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {/* 선택 월 총비용 + 전월 대비 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 6,
            }}
          >
            선택 월 총비용
          </div>
          <div style={kpiNumberStyle}>
            {kpi.currentTotal.toLocaleString()}억
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: kpi.diff >= 0 ? "#b91c1c" : "#047857",
              fontWeight: 600,
            }}
          >
            {kpi.diff >= 0 ? "▲" : "▼"} {kpi.diffRate.toFixed(1)}%
            {" · 전월 대비"}
          </div>
        </div>

        {/* 누적 총비용 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 6,
            }}
          >
            연간 누적 총비용 (선택 월까지)
          </div>
          <div style={kpiNumberStyle}>{kpi.ytdTotal.toLocaleString()}억</div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            기준:{" "}
            {monthlyTotalCost.length
              ? `${monthlyTotalCost[0].month} ~ ${selectedMonth}`
              : "-"}
          </div>
        </div>

        {/* 조회 월 선택 + 전년 동월 대비 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>조회 월 선택</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
              }}
            >
              {monthlyTotalCost.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.month}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            전년 동월 대비 {kpi.yoyDiff >= 0 ? "▲" : "▼"}{" "}
            {Math.abs(kpi.yoyRate).toFixed(1)}%
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#9ca3af",
              marginTop: 4,
            }}
          >
            {costMonthMeta.some((m) => m.year && m.month)
              ? `당해 ${kpi.currentTotal.toLocaleString()}억 / 전년 ${(
                  kpi.currentTotal - (kpi.yoyDiff || 0)
                ).toLocaleString()}억`
              : "연·월 정보가 없는 컬럼명이라 전년 동월 비교는 0으로 표시됩니다."}
          </div>
        </div>
      </div>

      {/* 그래프 두 개 (라인 + 파이) */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "2fr 1.1fr",
        }}
      >
        {/* 월별 총비용 추이 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            월별 총비용 추이 (전년 동월 비교, 최근 12개월)
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              {/* ✅ 여기서 monthlyTotalCost → lineChartData 로 변경 */}
              <LineChart data={lineChartData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="당해"
                  stroke={BRAND_GREEN}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="lastYear"
                  name="전년 동월"
                  stroke="#c4c4c4"
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 계정군별 비중 파이 */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            계정군별 비용 비중
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accountGroupShare}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                >
                  {accountGroupShare.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 코스트센터별 비용 bar */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "2fr",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            코스트센터별 비용 Top 5
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCostCenters}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="cost"
                  radius={[10, 10, 0, 0]}
                  fill={BRAND_ORANGE}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverviewPage;
