// src/components/tabs/VarianceTab.js
import React, { useMemo, useState } from "react";
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
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";

import { BRAND_DARK, BRAND_GREEN, BRAND_ORANGE } from "../../config/plConfig";

// ---- 컬러 팔레트 (브랜드 그린/오렌지 + 블루/퍼플 믹스) ----
const COLOR_PRIMARY = BRAND_GREEN; // 메인 라인/바
const COLOR_SECONDARY = "#3B82F6"; // 블루
const COLOR_ACCENT = BRAND_ORANGE; // 포인트 오렌지

// 🔥 증감 표현 색: 확실한 대비용 (초록 vs 레드)
const UP_COLOR = "#16A34A"; // 증가: 그린
const DOWN_COLOR = "#EF4444"; // 감소: 레드

const PIE_COLORS = [
  "#0EA5E9",
  "#6366F1",
  "#22C55E",
  "#F97316",
  "#EC4899",
  "#A855F7",
];

const fmt = (v) =>
  typeof v === "number" ? v.toLocaleString("ko-KR") : v ?? "-";

// ✅ 부서/코스트센터 “이름” 컬럼 찾아주는 헬퍼 (코드 컬럼은 제외)
const findCostCenterNameKey = (sample) => {
  if (!sample) return null;
  const keys = Object.keys(sample);

  // 문자열인 컬럼만 대상으로 먼저 본다
  const stringKeys = keys.filter((k) => typeof sample[k] === "string");
  const notCode = (k) => !/코드|code/i.test(k);

  // 1) 가장 확실한 이름 컬럼들 우선 (…명)
  const nameKey =
    stringKeys.find((k) => k.includes("코스트센터명")) ||
    stringKeys.find((k) => k.includes("부서명")) ||
    stringKeys.find((k) => k.includes("조직명")) ||
    stringKeys.find((k) => /cost.?center.?name/i.test(k)) ||
    stringKeys.find((k) => /dept.?name/i.test(k)) ||
    stringKeys.find((k) => /department/i.test(k));

  if (nameKey) return nameKey;

  // 2) “코드” 글자가 없는 부서/코스트센터 컬럼
  const genericKey =
    stringKeys.find((k) => /코스트센터/i.test(k) && notCode(k)) ||
    stringKeys.find((k) => /부서/i.test(k) && notCode(k)) ||
    stringKeys.find((k) => /조직/i.test(k) && notCode(k));

  if (genericKey) return genericKey;

  // 3) 그래도 못 찾으면, 코드일 수도 있지만 관련 있는 컬럼 아무거나
  const anyRelated =
    keys.find((k) => /코스트센터/i.test(k)) ||
    keys.find((k) => /부서/i.test(k)) ||
    keys.find((k) => /조직/i.test(k));

  if (anyRelated) return anyRelated;

  // 4) 마지막 완전 fallback: 문자열 컬럼 아무거나
  return stringKeys[0] || null;
};

// 코스트센터명으로 생산/관리 간단 분류
const classifyDept = (name) => {
  const s = String(name || "");
  if (/생산|제조|공장|라인|조립|프레스/.test(s)) return "생산";
  if (/관리|경영|지원|본부|총무|인사|재무|회계/.test(s)) return "관리";
  return "기타";
};

export function VarianceTab({
  varianceData = [],
  varianceSummary,
  monthlyTotalCost = [],
  costMonthMeta = [],
  costData = [],
  selectedMonth,
  accountGroupShare = [],
  closingAnalysis,
  cardStyle,
}) {
  const hasCostData =
    Array.isArray(costData) &&
    costData.length > 0 &&
    Array.isArray(costMonthMeta) &&
    costMonthMeta.length > 0;

  const monthOptions = useMemo(
    () =>
      Array.isArray(costMonthMeta) ? costMonthMeta.map((m) => m.label) : [],
    [costMonthMeta]
  );

  const effectiveMonth = useMemo(() => {
    if (selectedMonth && monthOptions.includes(selectedMonth))
      return selectedMonth;
    return monthOptions.length ? monthOptions[monthOptions.length - 1] : "";
  }, [selectedMonth, monthOptions]);

  // -----------------------------
  // 0-1. 계정코드 -> 계정명 매핑 (엑셀 헤더 기반)
  //   - 계정코드: '계정코드'
  //   - 계정명:   '계정명'
  // -----------------------------
  const accountNameMap = useMemo(() => {
    if (!hasCostData) return {};

    const sample = costData[0] || {};
    const keys = Object.keys(sample);

    const accCodeKey =
      keys.find((k) => k.includes("계정코드")) ||
      keys.find((k) => /account.?code/i.test(k));

    const accNameKey =
      keys.find((k) => k.includes("계정명")) ||
      keys.find((k) => /account.?name/i.test(k)) ||
      keys.find((k) => k.includes("계정"));

    if (!accCodeKey || !accNameKey) return {};

    const map = {};
    costData.forEach((row) => {
      const rawCode = row[accCodeKey];
      const name = row[accNameKey];
      if (rawCode == null || name == null) return;

      const s = String(rawCode);
      const norm = s.replace(/\.0+$/, ""); // 421010100.0 → 421010100

      map[s] = String(name);
      map[norm] = String(name);
    });

    return map;
  }, [hasCostData, costData]);

  // -----------------------------
  // 1. 상단 KPI Summary
  // -----------------------------
  const kpi = useMemo(() => {
    if (!monthlyTotalCost.length || !effectiveMonth) {
      return {
        cur: 0,
        prev: 0,
        momDiff: 0,
        momRate: 0,
        yoyDiff: 0,
        yoyRate: 0,
      };
    }
    const idx = monthlyTotalCost.findIndex((m) => m.month === effectiveMonth);
    if (idx === -1) {
      return {
        cur: 0,
        prev: 0,
        momDiff: 0,
        momRate: 0,
        yoyDiff: 0,
        yoyRate: 0,
      };
    }
    const cur = monthlyTotalCost[idx];
    const prev = idx > 0 ? monthlyTotalCost[idx - 1] : null;

    const curTotal = cur.total || 0;
    const prevTotal = prev ? prev.total || 0 : 0;
    const momDiff = curTotal - prevTotal;
    const momRate = prevTotal ? (momDiff / prevTotal) * 100 : 0;

    const yoyDiff = cur.lastYear ? curTotal - cur.lastYear : 0;
    const yoyRate = cur.lastYear ? (yoyDiff / cur.lastYear) * 100 : 0;

    return {
      cur: curTotal,
      prev: prevTotal,
      momDiff,
      momRate,
      yoyDiff,
      yoyRate,
    };
  }, [monthlyTotalCost, effectiveMonth]);

  // 현재월·전월 메타
  const currentMonthMeta = useMemo(() => {
    if (!hasCostData) return null;
    return (
      costMonthMeta.find((m) => m.label === effectiveMonth) ||
      costMonthMeta[costMonthMeta.length - 1]
    );
  }, [hasCostData, costMonthMeta, effectiveMonth]);

  const prevMonthMeta = useMemo(() => {
    if (!hasCostData || !currentMonthMeta) return null;
    const idx = costMonthMeta.findIndex((m) => m.col === currentMonthMeta.col);
    if (idx <= 0) return null;
    return costMonthMeta[idx - 1];
  }, [hasCostData, costMonthMeta, currentMonthMeta]);

  // -----------------------------
  // 1-2. 생산 vs 관리 비중 / 위험 부서
  // -----------------------------
  const deptStructure = useMemo(() => {
    if (!hasCostData || !currentMonthMeta) return null;

    const sample = costData[0] || {};
    const ccNameKey = findCostCenterNameKey(sample);

    const monthCol = currentMonthMeta.col;
    const prevCol = prevMonthMeta?.col;

    const byDeptType = { 생산: 0, 관리: 0, 기타: 0 };
    const byCostCenter = {};

    costData.forEach((row, idx) => {
      const rawName = ccNameKey ? row[ccNameKey] : null;
      const ccName =
        rawName && String(rawName).trim()
          ? String(rawName).trim()
          : `기타${ccNameKey ? "" : `_${idx + 1}`}`;

      const deptType = classifyDept(ccName);
      const curAmt = Number(row[monthCol]) || 0;
      const prevAmt = prevCol ? Number(row[prevCol]) || 0 : 0;

      if (!byDeptType[deptType]) byDeptType[deptType] = 0;
      byDeptType[deptType] += curAmt;

      const key = ccName;
      if (!byCostCenter[key]) {
        byCostCenter[key] = { cur: 0, prev: 0 };
      }
      byCostCenter[key].cur += curAmt;
      byCostCenter[key].prev += prevAmt;
    });

    let riskDept = null;
    Object.entries(byCostCenter).forEach(([name, v]) => {
      const diff = v.cur - v.prev;
      const rate = v.prev ? (diff / v.prev) * 100 : 0;
      if (!riskDept || diff > riskDept.diff) {
        riskDept = { name, diff, rate, cur: v.cur, prev: v.prev };
      }
    });

    return { byDeptType, riskDept };
  }, [hasCostData, costData, currentMonthMeta, prevMonthMeta]);

  // 2. 회사 전체 비용 추세 (최근 1년만)
  const totalTrendData = useMemo(() => {
    if (!monthlyTotalCost.length) return [];
    const last12 = monthlyTotalCost.slice(-12);
    return last12.map((m) => ({
      month: m.month,
      total: m.total,
      lastYear: m.lastYear || 0,
    }));
  }, [monthlyTotalCost]);

  // 2-1. 주요 계정별 추세 (Top 3)
  const majorAccountTrend = useMemo(() => {
    if (!hasCostData || costMonthMeta.length === 0) return [];

    const sample = costData[0] || {};
    const keys = Object.keys(sample);
    let accNameKey =
      keys.find((k) => k.includes("계정명")) ||
      keys.find((k) => /account.?name/i.test(k)) ||
      keys.find((k) => k.includes("계정"));

    const curMeta =
      costMonthMeta.find((m) => m.label === effectiveMonth) ||
      costMonthMeta[costMonthMeta.length - 1];
    if (!curMeta) return [];

    const curByAcc = {};
    costData.forEach((row) => {
      const name = String(row[accNameKey] || "기타");
      const v = Number(row[curMeta.col]) || 0;
      if (!curByAcc[name]) curByAcc[name] = 0;
      curByAcc[name] += v;
    });

    const topAcc = Object.entries(curByAcc)
      .map(([name, v]) => ({ name, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((x) => x.name);

    if (!topAcc.length) return [];

    const monthMap = costMonthMeta.map((meta) => {
      const rowObj = { month: meta.label };
      topAcc.forEach((acc) => {
        rowObj[acc] = 0;
      });
      return { meta, rowObj };
    });

    costData.forEach((row) => {
      const name = String(row[accNameKey] || "기타");
      if (!topAcc.includes(name)) return;
      monthMap.forEach(({ meta, rowObj }) => {
        const v = Number(row[meta.col]) || 0;
        rowObj[name] += v;
      });
    });

    return monthMap.map(({ rowObj }) => rowObj);
  }, [hasCostData, costData, costMonthMeta, effectiveMonth]);

  // -----------------------------
  // 3. 부서별 분석
  // -----------------------------
  const deptAnalysis = useMemo(() => {
    if (!hasCostData || !currentMonthMeta) {
      return { top: [], contrib: [], structure: [], growthTop: [] };
    }

    const sample = costData[0] || {};
    const ccNameKey = findCostCenterNameKey(sample);

    const curCol = currentMonthMeta.col;
    const prevCol = prevMonthMeta?.col;

    const byCC = {};
    costData.forEach((row, idx) => {
      const rawName = ccNameKey ? row[ccNameKey] : null;
      const cc =
        rawName && String(rawName).trim()
          ? String(rawName).trim()
          : `기타${ccNameKey ? "" : `_${idx + 1}`}`;

      const cur = Number(row[curCol]) || 0;
      const prev = prevCol ? Number(row[prevCol]) || 0 : 0;
      if (!byCC[cc]) byCC[cc] = { cur: 0, prev: 0 };
      byCC[cc].cur += cur;
      byCC[cc].prev += prev;
    });

    const arr = Object.entries(byCC).map(([name, v]) => {
      const diff = v.cur - v.prev;
      const rate = v.prev ? (diff / v.prev) * 100 : 0;
      return { name, cur: v.cur, prev: v.prev, diff, rate };
    });

    const totalCur = arr.reduce((a, x) => a + x.cur, 0);
    const contrib = arr
      .map((x) => ({
        name: x.name,
        cur: x.cur,
        pct: totalCur ? (x.cur / totalCur) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    const top = [...arr].sort((a, b) => b.cur - a.cur).slice(0, 8);
    const growthTop = [...arr]
      .filter((x) => x.prev > 0 && x.rate > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    const typeMap = { 생산: 0, 관리: 0, 기타: 0 };
    arr.forEach((x) => {
      const t = classifyDept(x.name);
      if (!typeMap[t]) typeMap[t] = 0;
      typeMap[t] += x.cur;
    });
    const structure = Object.entries(typeMap).map(([type, v]) => ({
      type,
      value: v,
    }));

    return { top, contrib, structure, growthTop };
  }, [hasCostData, costData, currentMonthMeta, prevMonthMeta]);

  // -----------------------------
  // 4. 계정별 전월/전년동월 변동 TOP 계정
  // -----------------------------
  const accountVarianceTop = useMemo(() => {
    // 4-1) 전월 대비 증감 Top 계정: varianceData 직접 사용
    let momTop = [];
    if (Array.isArray(varianceData) && varianceData.length) {
      momTop = varianceData
        .map((row) => {
          // 1) 계정명/코드 매핑
          let nameRaw =
            row.accountName ||
            row.account_name ||
            row.name ||
            row.accountCode ||
            row.account_code ||
            "계정";

          let name = String(nameRaw);

          const codeRaw =
            row.accountCode ||
            row.account_code ||
            row.account ||
            row.code ||
            null;

          if (
            codeRaw != null &&
            accountNameMap &&
            Object.keys(accountNameMap).length
          ) {
            const s = String(codeRaw);
            const norm = s.replace(/\.0+$/, "");
            const mapped = accountNameMap[s] || accountNameMap[norm];
            if (mapped) name = mapped;
          } else if (
            /^\d+(\.\d+)?$/.test(name) &&
            accountNameMap &&
            Object.keys(accountNameMap).length
          ) {
            const s = name;
            const norm = s.replace(/\.0+$/, "");
            const mapped = accountNameMap[s] || accountNameMap[norm];
            if (mapped) name = mapped;
          }

          const cur =
            Number(row.thisMonth ?? row.current ?? row.this ?? row.cur ?? 0) ||
            0;
          const prev =
            Number(row.lastMonth ?? row.prev ?? row.previous ?? 0) || 0;

          // diff, rate 계산 (증가/감소 모두 허용)
          const diff =
            row.diff !== undefined && row.diff !== null
              ? Number(row.diff)
              : cur - prev;

          const rate =
            prev !== 0
              ? row.rate !== undefined && row.rate !== null
                ? Number(row.rate)
                : (diff / prev) * 100
              : 0;

          return { name, cur, prev, diff, rate };
        })
        // 완전 0인 계정만 제외 (전월·당월 둘 다 0)
        .filter((x) => !(x.prev === 0 && x.cur === 0))
        // 🔥 전월 대비 “증감액” 절대값이 큰 순서대로 정렬
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 5);
    }

    // 4-2) 전년 동월 대비 증감 Top 계정: costData 기반
    let yoyTop = [];
    if (!hasCostData || !currentMonthMeta) {
      return { momTop, yoyTop: [] };
    }

    const sample = costData[0] || {};
    const keys = Object.keys(sample);

    let accNameKey =
      keys.find((k) => k.includes("계정명")) ||
      keys.find((k) => /account.?name/i.test(k)) ||
      keys.find((k) => k.includes("계정"));

    const curCol = currentMonthMeta.col;

    // 전년 동월 메타
    let yoyMeta = null;
    if (currentMonthMeta.label) {
      const labelStr = String(currentMonthMeta.label);
      const parts = labelStr.split(/[-/.]/);
      if (parts.length >= 2) {
        const yearPart = parts[0];
        const monthPart = parts[1];
        const yearNum = parseInt(yearPart, 10);
        if (!isNaN(yearNum)) {
          const targetYear = (yearNum - 1)
            .toString()
            .padStart(yearPart.length, "0");
          const targetLabel = `${targetYear}-${monthPart}`;
          yoyMeta =
            costMonthMeta.find((m) => String(m.label) === targetLabel) || null;
        }
      }
    }

    if (!yoyMeta) {
      return { momTop, yoyTop: [] };
    }

    const byAcc = {};
    costData.forEach((row) => {
      const name = String(row[accNameKey] || "기타");
      const cur = Number(row[curCol]) || 0;
      const yoyBase = Number(row[yoyMeta.col]) || 0;

      if (!byAcc[name]) byAcc[name] = { cur: 0, yoy: 0 };
      byAcc[name].cur += cur;
      byAcc[name].yoy += yoyBase;
    });

    yoyTop = Object.entries(byAcc)
      .map(([name, v]) => {
        const diff = v.cur - v.yoy;
        const rate = v.yoy ? (diff / v.yoy) * 100 : 0;
        return {
          name,
          cur: v.cur,
          base: v.yoy,
          diff,
          rate,
        };
      })
      .filter((x) => x.base > 0 && x.rate > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    return { momTop, yoyTop };
  }, [
    varianceData,
    hasCostData,
    costData,
    currentMonthMeta,
    costMonthMeta,
    accountNameMap,
  ]);

  // -----------------------------
  // 5. 계정별 상세 분석 (드릴다운)
  // -----------------------------
  const accountDrill = useMemo(() => {
    if (!hasCostData || costMonthMeta.length === 0) {
      return { options: [], trend: [], ccBreakdown: [], totalShare: 0 };
    }
    const sample = costData[0] || {};
    const keys = Object.keys(sample);
    let accNameKey =
      keys.find((k) => k.includes("계정명")) ||
      keys.find((k) => /account.?name/i.test(k)) ||
      keys.find((k) => k.includes("계정"));
    let ccNameKey =
      keys.find((k) => k.includes("코스트센터명")) ||
      keys.find((k) => k.includes("부서명")) ||
      keys.find((k) => k.includes("부서")) ||
      keys.find((k) => /cost.?center.?name/i.test(k)) ||
      keys.find((k) => /dept|department/i.test(k)) ||
      keys.find((k) => k.includes("코스트센터"));

    const curMeta =
      costMonthMeta.find((m) => m.label === effectiveMonth) ||
      costMonthMeta[costMonthMeta.length - 1];

    const curByAcc = {};
    costData.forEach((row) => {
      const name = String(row[accNameKey] || "기타");
      const v = Number(row[curMeta.col]) || 0;
      if (!curByAcc[name]) curByAcc[name] = 0;
      curByAcc[name] += v;
    });

    const options = Object.entries(curByAcc)
      .map(([name, v]) => ({ name, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    const totalCur = Object.values(curByAcc).reduce((a, v) => a + v, 0);

    return { options, totalCur, accNameKey, ccNameKey };
  }, [hasCostData, costData, costMonthMeta, effectiveMonth]);

  const [selectedAccount, setSelectedAccount] = useState(null);

  const selectedAccName =
    selectedAccount &&
    accountDrill.options.find((o) => o.name === selectedAccount)
      ? selectedAccount
      : accountDrill.options.length
      ? accountDrill.options[0].name
      : null;

  const selectedAccDetail = useMemo(() => {
    if (!hasCostData || !selectedAccName || !accountDrill.accNameKey) {
      return { trend: [], ccBreakdown: [], share: 0 };
    }

    const { accNameKey, ccNameKey, totalCur } = accountDrill;

    const trend = costMonthMeta.map((meta) => {
      let v = 0;
      costData.forEach((row) => {
        const name = String(row[accNameKey] || "기타");
        if (name !== selectedAccName) return;
        v += Number(row[meta.col]) || 0;
      });
      return {
        month: meta.label,
        amount: v,
      };
    });

    const curMeta =
      costMonthMeta.find((m) => m.label === effectiveMonth) ||
      costMonthMeta[costMonthMeta.length - 1];

    const ccMap = {};
    costData.forEach((row) => {
      const name = String(row[accNameKey] || "기타");
      if (name !== selectedAccName) return;
      const cc = String(row[ccNameKey] || "기타");
      const v = Number(row[curMeta.col]) || 0;
      if (!ccMap[cc]) ccMap[cc] = 0;
      ccMap[cc] += v;
    });
    const ccBreakdown = Object.entries(ccMap)
      .map(([cc, v]) => ({ costCenter: cc, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const curAccTotal = trend.length ? trend[trend.length - 1].amount : 0;
    const share = totalCur ? (curAccTotal / totalCur) * 100 : 0;

    return { trend, ccBreakdown, share, curAccTotal };
  }, [
    hasCostData,
    selectedAccName,
    accountDrill,
    costData,
    costMonthMeta,
    effectiveMonth,
  ]);

  // KPI 카드 공통 스타일 (각진)
  const kpiCardStyle = {
    ...cardStyle,
    padding: 12,
    borderRadius: 0,
    border: "1px solid #E5E7EB",
    boxShadow: "0 4px 8px rgba(15,23,42,0.03)",
  };

  // -----------------------------
  // 렌더링용 부가 값
  // -----------------------------
  const prodVal = deptStructure?.byDeptType?.["생산"] || 0;
  const mgmtVal = deptStructure?.byDeptType?.["관리"] || 0;
  const etcVal = deptStructure?.byDeptType?.["기타"] || 0;
  const deptTotal = prodVal + mgmtVal + etcVal || 1;
  const prodPct = (prodVal / deptTotal) * 100;
  const mgmtPct = (mgmtVal / deptTotal) * 100;

  // 도넛에 넣을 부서별 기여도 Top N
  const pieContribData = useMemo(
    () => deptAnalysis.contrib.slice(0, 8),
    [deptAnalysis.contrib]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. 상단 KPI 카드 4개 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {/* ① 당월 총비용 */}
        <div style={kpiCardStyle}>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            당월 총비용 (Company Total)
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: BRAND_DARK,
              marginBottom: 2,
            }}
          >
            {fmt(Math.round(kpi.cur))} 원
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            전월 {fmt(Math.round(kpi.prev))} 원
          </div>
        </div>

        {/* ② 전월 대비 증감 */}
        <div style={kpiCardStyle}>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            전월 대비 증감 (MoM)
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: kpi.momDiff >= 0 ? UP_COLOR : DOWN_COLOR,
              marginBottom: 2,
            }}
          >
            {kpi.momDiff >= 0 ? "▲" : "▼"}{" "}
            {fmt(Math.abs(Math.round(kpi.momDiff)))} 원
          </div>
          <div
            style={{
              fontSize: 11,
              color: kpi.momDiff >= 0 ? UP_COLOR : DOWN_COLOR,
            }}
          >
            {kpi.momRate >= 0 ? "+" : "-"}
            {Math.abs(kpi.momRate).toFixed(1)}%
          </div>
        </div>

        {/* ③ 전년 동월 대비 */}
        <div style={kpiCardStyle}>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            전년 동월 대비 (YoY)
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: kpi.yoyDiff >= 0 ? UP_COLOR : DOWN_COLOR,
              marginBottom: 2,
            }}
          >
            {kpi.yoyDiff >= 0 ? "▲" : "▼"}{" "}
            {fmt(Math.abs(Math.round(kpi.yoyDiff)))} 원
          </div>
          <div
            style={{
              fontSize: 11,
              color: kpi.yoyDiff >= 0 ? UP_COLOR : DOWN_COLOR,
            }}
          >
            {kpi.yoyRate >= 0 ? "+" : "-"}
            {Math.abs(kpi.yoyRate).toFixed(1)}%
          </div>
        </div>

        {/* ④ 부문 Mix & 위험 부서 */}
        <div style={kpiCardStyle}>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            생산 vs 관리 비중 & 위험 부서
          </div>
          <div style={{ fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: "#4b5563" }}>생산 </span>
            <strong>{prodPct.toFixed(1)}%</strong>{" "}
            <span style={{ marginLeft: 8, color: "#4b5563" }}>관리 </span>
            <strong>{mgmtPct.toFixed(1)}%</strong>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#9ca3af",
              marginBottom: 2,
            }}
          >
            기타 {((etcVal / deptTotal) * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            <span style={{ color: "#6b7280" }}>전월 대비 급증 부서: </span>
            {deptStructure?.riskDept ? (
              <span
                style={{
                  fontWeight: 600,
                  color:
                    deptStructure.riskDept.diff >= 0 ? UP_COLOR : DOWN_COLOR,
                }}
              >
                {deptStructure.riskDept.name}{" "}
                {deptStructure.riskDept.diff >= 0 ? "▲" : "▼"}{" "}
                {fmt(Math.abs(Math.round(deptStructure.riskDept.diff)))} /{" "}
                {deptStructure.riskDept.rate >= 0 ? "+" : "-"}
                {Math.abs(deptStructure.riskDept.rate).toFixed(1)}%
              </span>
            ) : (
              <span style={{ color: "#9ca3af" }}>
                비교 가능한 전월 데이터 없음
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. 회사 전체 비용 추세 + 주요 계정 추세 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2.1fr 1.5fr",
          gap: 12,
        }}
      >
        {/* 2-1. 전체 비용 추세 */}
        <div
          style={{
            ...cardStyle,
            borderRadius: 0,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
            2. 회사 전체 비용 추세
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
            최근 1년 기준 월별 총비용과 전년 동월을 동시에 비교합니다.
          </div>
          <div style={{ width: "100%", height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={totalTrendData}
                margin={{ top: 6, right: 8, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="totalArea" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={COLOR_PRIMARY}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={COLOR_PRIMARY}
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="lastYearArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9CA3AF" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#9CA3AF" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 0,
                    border: "1px solid #e5e7eb",
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />

                <Area
                  type="monotone"
                  dataKey="lastYear"
                  name="전년 동월"
                  stroke="#9ca3af"
                  strokeWidth={1.3}
                  fill="url(#lastYearArea)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="총비용"
                  stroke={COLOR_PRIMARY}
                  strokeWidth={2}
                  fill="url(#totalArea)"
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2-1. 주요 계정별 추세 (Top 3) */}
        <div
          style={{
            ...cardStyle,
            borderRadius: 0,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
            2-1. 주요 계정별 추세 (Top 3)
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
            당월 기준 상위 3개 계정의 월별 흐름입니다.
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={majorAccountTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 0,
                    border: "1px solid #e5e7eb",
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {majorAccountTrend.length > 0 &&
                  Object.keys(majorAccountTrend[0])
                    .filter((k) => k !== "month")
                    .map((key, idx) => (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={key}
                        stroke={PIE_COLORS[idx % PIE_COLORS.length]}
                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        fillOpacity={0.16}
                      />
                    ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. 부서별 비용 + 3-1 구조/기여도 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.6fr",
          gap: 12,
        }}
      >
        {/* 3. 부서별 비용 Top & 증가율 Top5 */}
        <div
          style={{
            ...cardStyle,
            borderRadius: 0,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            3. 부서별 비용 Top & 전월 대비 증가율 Top 5
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptAnalysis.top}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    typeof v === "string" && v.length > 6
                      ? v.slice(0, 6) + "…"
                      : v
                  }
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 0,
                    border: "1px solid #e5e7eb",
                    fontSize: 11,
                  }}
                />
                <Bar
                  dataKey="cur"
                  name="당월 비용"
                  radius={0}
                  fill={COLOR_SECONDARY}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#6b7280",
              display: "flex",
              gap: 8,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                전월 대비 증가율 Top 5
              </div>
              <div
                style={{
                  maxHeight: 120,
                  overflowY: "auto",
                  borderRadius: 0,
                  border: "1px solid #e5e7eb",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 11,
                  }}
                >
                  <tbody>
                    {deptAnalysis.growthTop.map((d) => (
                      <tr key={d.name}>
                        <td
                          style={{
                            padding: "4px 6px",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {d.name}
                        </td>
                        <td
                          style={{
                            padding: "4px 6px",
                            borderBottom: "1px solid #f3f4f6",
                            textAlign: "right",
                            color: d.diff >= 0 ? UP_COLOR : DOWN_COLOR,
                          }}
                        >
                          {d.diff >= 0 ? "▲" : "▼"}{" "}
                          {fmt(Math.abs(Math.round(d.diff)))} (
                          {d.rate >= 0 ? "+" : "-"}
                          {Math.abs(d.rate).toFixed(1)}%)
                        </td>
                      </tr>
                    ))}
                    {!deptAnalysis.growthTop.length && (
                      <tr>
                        <td
                          style={{
                            padding: "4px 6px",
                            textAlign: "center",
                            color: "#9ca3af",
                          }}
                        >
                          표시할 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 3-1. 부서 구조 & 기여도 */}
        <div
          style={{
            ...cardStyle,
            borderRadius: 0,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            3-1. 부서 구조 및 비용 기여도
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1.7fr",
              gap: 14,
              fontSize: 11,
              alignItems: "center",
            }}
          >
            {/* 구조 도넛: 부서별 기여도 Top N */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  marginBottom: 8,
                  color: "#6b7280",
                  fontSize: 11,
                }}
              >
                부서별 비용 기여도 (도넛, Top 8)
              </div>
              <div style={{ width: "100%", height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieContribData}
                      dataKey="pct"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {pieContribData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 0,
                        border: "1px solid #e5e7eb",
                        fontSize: 11,
                      }}
                      formatter={(value, _name, payload) => [
                        `${value.toFixed(1)}%`,
                        payload?.payload?.name || "부서",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 기여도 테이블 */}
            <div>
              <div
                style={{
                  marginBottom: 8,
                  color: "#6b7280",
                  fontSize: 11,
                }}
              >
                부서별 비용 기여도 (이번달)
              </div>
              <div
                style={{
                  maxHeight: 210,
                  overflowY: "auto",
                  borderRadius: 0,
                  border: "1px solid #e5e7eb",
                }}
              >
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
                        backgroundColor: "#F9FAFB",
                        position: "sticky",
                        top: 0,
                      }}
                    >
                      <th
                        style={{
                          textAlign: "left",
                          padding: "6px 8px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        부서
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "6px 8px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        기여도(%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptAnalysis.contrib.map((d) => (
                      <tr key={d.name}>
                        <td
                          style={{
                            padding: "6px 8px",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {d.name}
                        </td>
                        <td
                          style={{
                            padding: "6px 8px",
                            textAlign: "right",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {d.pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    {!deptAnalysis.contrib.length && (
                      <tr>
                        <td
                          colSpan={2}
                          style={{
                            padding: "6px 8px",
                            textAlign: "center",
                            color: "#9ca3af",
                          }}
                        >
                          표시할 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. 계정별 전월/전년동월 증감 Top 계정 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 2fr",
          gap: 12,
        }}
      >
        {/* 4. 전월 대비 증감 TOP 계정 */}
        <div
          style={{
            ...cardStyle,
            borderRadius: 0,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            4. 전월 대비 증감 TOP 계정
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
            전월 대비 <strong>증감액</strong>이 큰 세부 계정을 보여줍니다.
            (백엔드 varianceData 기준)
          </div>

          {/* 🔥 4-1) 상단 바차트 (증감액 기준) */}
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accountVarianceTop.momTop}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    typeof v === "string" && v.length > 8
                      ? v.slice(0, 8) + "…"
                      : v
                  }
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    typeof v === "number" ? (v / 1_000_000).toFixed(0) + "M" : v
                  }
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 0,
                    border: "1px solid #e5e7eb",
                    fontSize: 11,
                  }}
                  formatter={(value, _name, payload) => {
                    const p = payload && payload.payload;
                    const ratePart =
                      p && typeof p.rate === "number"
                        ? ` / 증감률 ${p.rate >= 0 ? "+" : "-"}${Math.abs(
                            p.rate
                          ).toFixed(1)}%`
                        : "";
                    return [`${fmt(Math.round(value))}원${ratePart}`, "증감액"];
                  }}
                  labelFormatter={(label, payload) => {
                    const p = payload && payload[0] && payload[0].payload;
                    if (!p) return label;
                    return `${label} (당월 ${fmt(
                      Math.round(p.cur)
                    )} / 전월 ${fmt(Math.round(p.prev))})`;
                  }}
                />
                <Bar dataKey="diff" name="증감액" barSize={18} radius={0}>
                  {accountVarianceTop.momTop.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.diff >= 0 ? UP_COLOR : DOWN_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 4-2) 상세 테이블: 차트와 동일한 데이터 사용 */}
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            전월 대비 증감 TOP 계정 상세
          </div>
          <div
            style={{
              marginTop: 4,
              maxHeight: 160,
              overflowY: "auto",
              borderRadius: 0,
              border: "1px solid #e5e7eb",
            }}
          >
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
                    backgroundColor: "#F9FAFB",
                    position: "sticky",
                    top: 0,
                  }}
                >
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    계정
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "6px 8px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    전월 금액
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "6px 8px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    당월 금액
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "6px 8px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    증감액
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "6px 8px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    증감률(%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {accountVarianceTop.momTop.map((p) => (
                  <tr key={p.name}>
                    <td
                      style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {p.name}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid #f3f4f6",
                        textAlign: "right",
                      }}
                    >
                      {fmt(Math.round(p.prev))}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid #f3f4f6",
                        textAlign: "right",
                      }}
                    >
                      {fmt(Math.round(p.cur))}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid #f3f4f6",
                        textAlign: "right",
                        color: p.diff >= 0 ? UP_COLOR : DOWN_COLOR,
                        fontWeight: 600,
                      }}
                    >
                      {p.diff >= 0 ? "▲" : "▼"}{" "}
                      {fmt(Math.abs(Math.round(p.diff)))}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid #f3f4f6",
                        textAlign: "right",
                        color: p.diff >= 0 ? UP_COLOR : DOWN_COLOR,
                        fontWeight: 600,
                      }}
                    >
                      {p.rate >= 0 ? "+" : "-"}
                      {Math.abs(p.rate).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {!accountVarianceTop.momTop.length && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "6px 8px",
                        textAlign: "center",
                        color: "#9ca3af",
                      }}
                    >
                      표시할 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4-1. 전년 동월(YoY) 대비 증감 TOP 계정 */}
        <div
          style={{
            ...cardStyle,
            borderRadius: 0,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            4-1. 전년 동월(YoY) 대비 증감 TOP 계정
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
            전년 같은 달 대비 증가율이 큰 세부 계정을 보여줍니다.
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={accountVarianceTop.yoyTop}
                layout="vertical"
                margin={{ left: 80 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  domain={[0, "dataMax + 5"]}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    typeof v === "string" && v.length > 10
                      ? v.slice(0, 10) + "…"
                      : v
                  }
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 0,
                    border: "1px solid #e5e7eb",
                    fontSize: 11,
                  }}
                  formatter={(value) => [`${value.toFixed(1)}%`, "증감률"]}
                  labelFormatter={(label, payload) => {
                    const p = payload && payload[0] && payload[0].payload;
                    if (!p) return label;
                    return `${label} (당월 ${fmt(
                      Math.round(p.cur)
                    )} / 전년동월 ${fmt(Math.round(p.base))})`;
                  }}
                />
                <Bar
                  dataKey="rate"
                  name="증감률(%)"
                  barSize={14}
                  radius={0}
                  fill={COLOR_PRIMARY}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. 계정별 상세 분석 (단일 카드) */}
      <div
        style={{
          ...cardStyle,
          borderRadius: 0,
          padding: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          5. 계정별 상세 분석 (상여/출장비/감가 등)
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 8,
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          <span>계정 선택</span>
          <select
            value={selectedAccName || ""}
            onChange={(e) => setSelectedAccount(e.target.value)}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 0,
              border: "1px solid #e5e7eb",
              outline: "none",
              minWidth: 160,
            }}
          >
            {accountDrill.options.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name}
              </option>
            ))}
          </select>
          <span>
            회사 전체 대비 비중:{" "}
            <strong>
              {selectedAccDetail.share
                ? selectedAccDetail.share.toFixed(1)
                : "0.0"}
              %
            </strong>
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {/* 월별 추이 */}
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
              월별 추이
            </div>
            <div style={{ width: "100%", height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedAccDetail.trend}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 0,
                      border: "1px solid #e5e7eb",
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    name={selectedAccName || "계정"}
                    stroke={COLOR_PRIMARY}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 부서별 Breakdown */}
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
              부서별 Breakdown (현재월)
            </div>
            <div style={{ width: "100%", height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={selectedAccDetail.ccBreakdown}
                  layout="vertical"
                  margin={{ left: 60 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="costCenter"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) =>
                      typeof v === "string" && v.length > 6
                        ? v.slice(0, 6) + "…"
                        : v
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 0,
                      border: "1px solid #e5e7eb",
                      fontSize: 11,
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name="금액"
                    barSize={8}
                    radius={0}
                    fill={COLOR_SECONDARY}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VarianceTab;
