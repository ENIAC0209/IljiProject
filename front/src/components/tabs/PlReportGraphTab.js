import React, { useEffect, useMemo, useState } from "react";

/* ============================
 *  코드 → 내역 매핑 테이블들
 *  (PlReportTab.js 와 동일한 매핑)
 * ============================ */

// 플랜트
const PLANT_LABELS = {
  "1010": "경산",
  "1021": "경주1",
  "1022": "경주2",
  "1023": "경주3",
  "1024": "경주4",
};

// Prod.계층구조01-2
const PROD_HIER_LABELS = {
  "100001": "BACK",
  "101001": "C/LAMP",
  "102001": "COWL",
  "103001": "CTR FLR",
  "104001": "DASH",
  "104002": "DASH&COWL",
  "104003": "DASH&COWL&FR PLR",
  "105001": "DASH CROSS MBR",
  "106001": "F/APRON COMPL",
  "106002": "F/APRON PNL",
  "106003": "F/APRON MBR",
  "107001": "FR PLR",
  "108001": "P/TRAY",
  "109001": "QTR INR COMPL",
  "109002": "QTR LWR",
  "109003": "QTR UPR",
  "110001": "SUNROOF",
  "110002": "PANORAMA SUNROOF",
  "110003": "VISION ROOF",
  "111001": "RR EXTN",
  "112001": "RR FLR COMPL",
  "112002": "PNL-RR FLR",
  "112003": "MBR-RR FLR",
  "113001": "RR STEP",
  "114001": "REINF SIDE OTR COMPL",
  "114002": "SIDE INR",
  "114003": "SIDE OTR",
  "115001": "SIDE SILL",
  "116001": "STRC 740",
  "116002": "STRC 741",
  "116003": "STRC 747",
  "116004": "STRC 749",
  "116005": "STRC 760",
  "116006": "STRC 764",
  "116007": "STRC 767",
  "116008": "STRC 768",
  "116009": "STRC 780",
  "116010": "STRC 789",
  "116011": "STRC 793",
  "116012": "STRC 798",
  "116013": "STRC 799",
  "116014": "STRC 801",
  "116015": "STRC 805",
  "116016": "STRC 808",
  "116017": "STRC 810",
  "116018": "STRC 813",
  "116019": "STRC 816",
  "116020": "STRC 840",
  "116021": "STRC 845",
  "116022": "STRC 846",
  "116023": "STRC 859",
  "116024": "STRC 863",
  "116025": "STRC 864",
  "200001": "FR DR",
  "200002": "RR DR",
  "201001": "HOOD",
  "202001": "T/GATE",
  "203001": "T/LID",
  "300001": "RAD SUPT",
  "800001": "BCA",
  "800002": "BATTERY",
  "801001": "H/W",
  "802001": "PARTITION",
  "803001": "PAD, SEALER",
  "804001": "TYPE D",
  "804002": "TYPE E",
  "804003": "TYPE F",
  "804004": "TYPE D-HV",
  "804005": "TYPE E-HV",
  "810001": "금형",
  "810002": "설비",
  "820001": "I/F",
  "820002": "C/F",
  "830001": "COIL",
  "890001": "ETC",
  "900S11": "공구류",
  "900S12": "벨트류",
  "900S13": "베어링류",
  "900S14": "CASTER류",
  "900S15": "볼트너트류",
  "900S16": "철자재류",
  "900S17": "금형부품류",
  "900S18": "전기부품류",
  "900S19": "용접부품류",
  "900S20": "안전보호구류",
  "900S21": "페인트류",
  "900S22": "유공압류",
  "900S23": "GAS류",
  "900S24": "OIL류",
  "900S25": "배관자재류",
  "900S26": "호스류",
  "900S27": "잡자재류",
  "900S28": "시설수리비",
  "900S29": "금형펀치류",
  "910P01": "납입용기",
  "910P02": "운반구",
  "910P03": "포장재",
  "920I01": "(IT)하드웨어",
  "920I02": "(IT)소프트웨어",
  "920I03": "(IT)네트워크",
  "920I04": "(IT)솔루션",
  "920I05": "(IT)소모품",
  "920I06": "(IT)유지보수",
  "930F01": "(사무)장비",
  "930F02": "(사무)라이선스",
  "930F03": "(사무)사무기기",
  "930F04": "(사무)소모품",
  "980V01": "공사/프로젝트",
  "980V02": "설비수리",
  "980V03": "용역",
};

// 평가클래스
const VAL_CLASS_LABELS = {
  "3000": "원재료",
  "3010": "부재료-1차사직거래품",
  "3011": "부재료-2차사반제품",
  "3012": "부재료-핫스템핑",
  "3013": "부재료-HMC사급품",
  "3014": "부재료-H/W",
  "3015": "부재료-PAD",
  "3016": "부재료-구조용접착제",
  "3100": "상품(부품)",
  "3110": "상품(투자개발)",
  "7900": "반제품",
  "7920": "완제품",
};

// 손익센터
const PROFIT_CENTER_LABELS = {
  "1010": "본사공통",
  "1011": "본사1",
  "1012": "본사2",
  "1020": "경주공통",
  "1021": "경주1",
  "1022": "경주2",
  "1023": "경주3",
  "1024": "경주4",
};

// 유통경로
const CHANNEL_LABELS = {
  "10": "내수 (10,20)",
  "20": "로컬",
  "30": "직수출",
  "90": "사급 (90,91)",
  "91": "비사급",
  "92": "스크랩",
};

// 기타매출 유형
const OTHER_SALES_TYPE_LABELS = {
  "1": "OEM",
  "2": "시작차",
  "3": "부산물",
  "4": "수수료",
  "5": "태양광",
  "6": "리비안",
  "7": "NX5",
  "8": "NX5a",
  A: "폐기(배부)",
  B: "실사조정(배부)",
  C: "유상사급(배부)",
  D: "경상개발비(배부)",
  E: "소비재평가(배부)",
  F: "기타(무상)",
  G: "고객무상판매",
  H: "재료비 기타",
  Z: "결산조정",
};

// 레코드 유형
const RECORD_TYPE_LABELS = {
  "1": "기타매출계획",
  "2": "수출제비용 계획",
  "3": "운송비계획",
  A: "수주",
  B: "FI에서 직접전기",
  C: "오더/프로젝트 정산",
  D: "간접비",
  E: "단일거래코스팅",
  F: "청구 데이터",
  G: "고객계약",
  H: "통계 주요 지표",
  I: "오더관련 프로젝트",
  L: "출고",
  Y: "PA재집계",
  Z: "매출원가조정(프로그램)",
};

// 판매문서 유형 (원본 유지)
const SD_DOC_TYPE_LABELS = {
  "1": "고객 독립 소요량",
  AA: "판촉 오더",
  AD1: "A&D 계약",
  AD2: "A&D 차변 메모 요청",
  AD3: "A&D 소급 대금청구",
  AD9: "RRB 오더",
  AE: "서비스 오더 견적",
  AEBO: "표준 오더",
  AEBQ: "오퍼",
  AP: "프로젝트 견적",
  AR: "수리 견적",
  AS: "서비스 견적",
  AV: "일괄 계약 견적",
  B1: "리베이트대변메모요청",
  B1E: "예상리베이트대변메모",
  B2: "리베이트 수정 요청",
  B2E: "확장리베이트수정요청",
  B3: "분할리베이트정산요청",
  B3E: "예상분할리베이트정산",
  B4: "수동발생리베이트요청",
  BIND: "간접 영업 리베이트",
  BK1: "대변 메모 요청계약",
  BK3: "대변 메모 요청계약",
  BM1: "차변메모요청계약",
  BM3: "차변메모요청계약",
  BSC: "서비스 계약 BDR",
  BSVC: "서비스 확인 eBDR",
  BSVO: "서비스 오더 eBDR",
  BV: "현금 판매",
  CBIC: "회사 간 오더",
  CBOS: "신용 서비스 시트",
  CBRE: "약식 반품",
  CBSS: "신용 서비스 시트",
  CFB3: "CF 분할리베이트정산",
  CFG2: "CF 대변 메모 요청",
  CH: "계약 처리",
  CLRP: "요청 및 반품",
  CMDM: "표준 오더",
  CMR: "표준 오더",
  CMRC: "표준 오더",
  CMRP: "표준 오더",
  CQ: "수량 일괄 계약",
  CR: "대변 메모 요청",
  CR1: "서비스 대변메모 요청",
  DHU: "SlsDocTypeDelyHUmvmt",
  DJIT: "오더 유형 JIT",
  DL: "오더 유형 일정 계약",
  DL2: "ARM 고객 반품",
  DLR: "반품 오더 유형",
  DLRE: "반품 오더 유형",
  DMRB: "표준 오더",
  DMRP: "표준 오더",
  DMRR: "표준 오더",
  DR: "차변 메모 요청",
  DR1: "서비스 차변메모 요청",
  DZL: "납품오더유형",
  ED: "외부대행업체출고",
  EDKO: "외부대행업체수정",
  FCQ: "",
  FD: "무상 납품",
  G2LV: "",
  G2W: "대변 메모 요청",
  G2WT: "대변메모 요청값",
  GA2: "대변 메모 요청",
  GCQ: "GG 수량 계약",
  GCTA: "표준 오더",
  GK: "마스터 계약",
  GOR: "GG 표준 오더",
  GPLM: "GG SW 유지보수",
  GQT: "GG 견적",
  GRE: "GG 반품",
  GVC: "GG 금액 계약",
  HBIN: "문의",
  HBOR: "표준 오더",
  HBQT: "견적",
  IBOS: "문의",
  ICPL: "고객 가격 리스트",
  IN: "문의",
  J3G1: "CEM 원가 정산",
  J3G2: "CEM 고객 정산",
  J3G6: "CEM 내부 자재 판매",
  J3G7: "CEM 내부 자재 재매입",
  J3G8: "CEM 외부 자재 판매",
  J3G9: "CEM 외부 자재 재매입",
  J3GB: "CEM 내부 대변 메모",
  J3GC: "CEM 외부 대변 메모",
  JBCD: "대변 메모 요청",
  JBDM: "차변 메모 요청",
  JGL: "대변 메모 요청(반품)",
  JLL: "차변 메모 요청(반품)",
  JOR: "표준 오더",
  JPCD: "대변 메모 요청",
  JPCM: "대변 메모 요청",
  JPDD: "차변 메모 요청",
  JPDM: "차변 메모 요청",
  JRE: "표준 오더",
  JREW: "표준 오더",
  JSDC: "대변 메모 요청",
  JSDD: "대변 메모 요청",
  JSDQ: "출하후지급 수량 계약",
  JSMC: "대변 메모 요청",
  JST1: "",
  KA: "위탁품 회수",
  KAZU: "위탁품회수 CompS",
  KB: "위탁품 입고",
  KE: "위탁품 출고",
  KR: "위탁품 반환",
  KRZU: "위탁품 반환 CompS",
  L2DM: "비용: 차변 메모 요청",
  L2DP: "비용: 지급 요청",
  L2W: "차변 메모 요청",
  L2WT: "차변 메모 요청 값",
  LA: "반품용 포장재 회수",
  LK: "납품일정계약Ex.Agent",
  LKJ: "JIT 일정계약(위탁품)",
  LN: "반환용포장재출고",
  LP: "일정 계약",
  LV: "일괄계약차변메모요청",
  LXE: "XLO 대체 납품 일정",
  LXI: "XLO 내부 납품 일정",
  LZ: "릴리스 납품일정계약",
  LZER: "",
  LZJ: "JIT 일정 계약",
  LZJE: "JIT 일정 계약 ESA",
  LZJQ: "JIT 일정 계약(LQ)",
  LZM: "납품오더납품일정계약",
  LZS: "SA:송장으로 자체청구",
  MAKO: "납품오더수정",
  MV: "임대차 계약",
  NL: "보충 납품",
  OBLS: "오더 총액",
  OBOS: "오더 단위",
  OBSS: "OBSS",
  OR: "표준 오더",
  OR1: "표준 오더",
  PHAM: "",
  PHAV: "",
  PHOR: "",
  PLPA: "펜듀럼 리스트 요청",
  PLPR: "펜듀럼 리스트 재설정",
  PLPS: "펜듀럼 리스트 취소",
  POOL: "풀링 오더",
  PV: "품목 제안",
  QBLS: "견적 총액",
  QBOS: "견적 단위 BOS",
  QCPL: "고객 가격 리스트",
  QT: "견적",
  QTLV: "LV/QTO 요청",
  RA: "수리 요청",
  RA2: "ARM 사내 수리",
  RAF: "",
  RAG: "재고 정보",
  RAS: "수리 / 서비스 1",
  RE: "반품",
  RE2: "고급 반품",
  RK: "송장 수정 요청",
  RM: "업체 반품 오더",
  RTTC: "고객에게 SPE 반품",
  RTTR: "SPE 반품 정비",
  RX2: "ARM 외부 수리 오더",
  RXE: "XLO 이전 반품",
  RXI: "XLO 내부 오더",
  RZ: "반품 납품 일정 계약",
  SCR: "서비스의대변메모요청",
  SD: "차후 무상 납품",
  SD2: "ARM SDF",
  SI: "판매 정보",
  SO: "긴급 오더",
  SOR: "",
  SRVO: "판매 오더(서비스)",
  SRVP: "솔루션 견적 오더",
  STAT: "문의",
  TAF: "표준 오더(FPl)",
  TAM: "납품 오더",
  TAV: "표준 오더(VMI)",
  TBOS: "서비스 입력 시트",
  TBSS: "수행된 서비스 입력",
  TSA: "전화 영업",
  TXE: "XLO 이전 오더",
  TXI: "XLO 내부 오더",
  UPRR: "사용 부품 반품",
  UUPR: "신규 부품 반품",
  VBOS: "자재 관련 값 계약",
  VLAF: "",
  VLAG: "",
  VLRE: "",
  VLTA: "",
  VSH1: "버전 오더",
  WA: "값일괄계약관련",
  WK1: "값일괄계약-생성",
  WK2: "자재관련 값일괄계약",
  WL: "",
  WMPP: "WM 제품 공급",
  WV: "서비스 및 유지보수",
  ZCR: "대변 메모(-)",
  ZCR1: "선입고(-)",
  ZDR: "차변 메모(+)",
  ZDR1: "선입고(+)",
  ZEX: "KD수출",
  ZFD: "기타출고(무상)",
  ZKA: "위탁품 회수",
  ZKB: "위탁품 보충",
  ZKE: "위탁품 출고",
  ZKE2: "위탁품 출고(XXX)",
  ZKR: "위탁품 반환",
  ZOR: "고객판매",
  ZOR1: "사급판매",
  ZOR3: "투자개발 매각",
  ZOR4: "투자개발-잡이익",
  ZOR9: "스크랩 매각",
  ZRE: "고객 반품",
  ZRE1: "사급 반품",
  ZREN: "고객 무상 반품",
  ZTO: "시작품 판매",
};

// 조건명 → 매핑 테이블
const LABEL_MAPS = {
  플랜트: PLANT_LABELS,
  "Prod.계층구조01-2": PROD_HIER_LABELS,
  평가클래스: VAL_CLASS_LABELS,
  손익센터: PROFIT_CENTER_LABELS,
  유통경로: CHANNEL_LABELS,
  판매문서유형: SD_DOC_TYPE_LABELS,
  기타매출유형: OTHER_SALES_TYPE_LABELS,
  레코드유형: RECORD_TYPE_LABELS,
};

const getCodeLabel = (cond, code) => {
  const map = LABEL_MAPS[cond];
  if (!map) return code;
  return map[code] || code;
};

// 손익 구조에서 보여줄 항목 순서
const KPI_ORDER = ["매출액", "매출원가계", "매출총이익", "판매비와일반관리비", "영업이익", "영업외수익", "영업외비용", "당기순이익"];

/* ============================
 * ✅ 조건 화면 전용: "전부 다른 색" 생성기
 * ============================ */
const colorFromIndex = (idx) => {
  const hue = (idx * 137.508) % 360; // golden angle
  return `hsl(${hue}, 70%, 45%)`;
};

// 4번 영역 막대 색상
const getShareColor = (share) => {
  if (share >= 25) return "#1d4ed8";
  if (share >= 15) return "#3b82f6";
  if (share >= 8) return "#93c5fd";
  return "#dbeafe";
};

function PlReportGraphTab({ rows, selectedCond, selectedYear, selectedMonth }) {
  const hasData = rows && rows.length > 0;

  // 요약 컬럼 이름: 전체 / 조건_전체
  const summaryColName = selectedCond === "전체" ? "전체" : `${selectedCond}_전체`;

  const getValue = (itemName) => {
    if (!hasData) return 0;
    const row = rows.find((r) => (r["항목"] || "").trim() === itemName) || null;
    if (!row) return 0;
    if (!Object.prototype.hasOwnProperty.call(row, summaryColName)) return 0;
    const v = Number(row[summaryColName]);
    if (Number.isNaN(v)) return 0;
    return v;
  };

  const formatNumber = (v) => {
    if (v === null || v === undefined || v === "" || Number.isNaN(v)) return "-";
    return Number(v).toLocaleString("ko-KR");
  };

  const formatSigned = (v) => {
    const num = Number(v);
    if (Number.isNaN(num)) return "-";
    const sign = num > 0 ? "+" : "";
    return sign + Math.round(num).toLocaleString("ko-KR");
  };

  const formatRate = (v) => {
    const num = Number(v);
    if (Number.isNaN(num)) return "-";
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(1)}%`;
  };

  // 항목 문자열의 들여쓰기(공백 개수) 계산
  const getIndentLevel = (rawName) => {
    if (!rawName) return 0;
    const match = String(rawName).match(/^(\s*)/);
    return match ? match[1].length : 0;
  };

  /**
   * 결산보고서_양식 구조 기반 세부항목 TopN
   * - colNameOverride를 주면 해당 컬럼으로 세부항목을 뽑음
   */
  const getDetailGroup = (parentTitle, topN = 10, colNameOverride = null) => {
    if (!hasData) return { total: 0, items: [] };

    const colName = colNameOverride || summaryColName;

    const parentIndex = rows.findIndex((r) => (r["항목"] || "").trim() === parentTitle);
    if (parentIndex === -1) return { total: 0, items: [] };

    const parentRaw = rows[parentIndex]["항목"] || "";
    const parentIndent = getIndentLevel(parentRaw);
    const parentValue = Number(rows[parentIndex][colName]) || 0;

    const agg = {};

    for (let i = parentIndex + 1; i < rows.length; i += 1) {
      const rawName = rows[i]["항목"] || "";
      const indent = getIndentLevel(rawName);

      if (indent <= parentIndent) break;

      const label = rawName.trim();
      if (!label) continue;

      if ((parentTitle === "매출원가계" && label === "매출원가") || (parentTitle === "판매비와일반관리비" && label === "판관비")) continue;

      const value = Number(rows[i][colName]) || 0;
      if (!value) continue;

      if (!agg[label]) agg[label] = 0;
      agg[label] += value;
    }

    const labels = Object.keys(agg);
    if (labels.length === 0) return { total: parentValue, items: [] };

    let items = labels
      .map((name) => ({ name, value: agg[name] }))
      .filter((d) => d.value !== 0);

    if (items.length === 0) return { total: parentValue, items: [] };

    items.sort((a, b) => b.value - a.value);
    items = items.slice(0, topN);

    const base = parentValue || items.reduce((s, d) => s + d.value, 0) || 1;

    const withShare = items.map((d) => ({
      ...d,
      share: (d.value / base) * 100,
    }));

    return { total: parentValue, items: withShare };
  };

  /**
   * ✅ 조건 선택 시: 특정 항목의 "조건코드별 Top10" 산출
   */
  const getConditionTop10ByItem = (itemName) => {
    if (!hasData || selectedCond === "전체") return { total: 0, items: [] };

    const row = rows.find((r) => (r["항목"] || "").trim() === itemName) || null;
    if (!row) return { total: 0, items: [] };

    const prefix = `${selectedCond}_`;
    const totalCol = `${selectedCond}_전체`;

    const cols = Object.keys(rows[0] || {}).filter((c) => c.startsWith(prefix) && c !== totalCol);
    const total = Number(row[totalCol]) || 0;

    const items = cols
      .map((col) => {
        const code = col.replace(prefix, "");
        const value = Number(row[col]) || 0;
        return {
          col,
          code,
          label: getCodeLabel(selectedCond, code),
          value,
          share: total ? (value / total) * 100 : 0,
        };
      })
      .filter((d) => d.value !== 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return { total, items };
  };

  // -----------------------------
  // 0) 핵심 값
  // -----------------------------
  const totalSalesAll = getValue("매출액");
  const operatingIncome = getValue("영업이익");
  const netIncome = getValue("당기순이익");

  const domesticSales = getValue("국내매출액");
  const exportSales = getValue("수출매출액");
  const totalDomesticExport = domesticSales + exportSales || 1;
  const domesticPct = (domesticSales / totalDomesticExport) * 100;
  const exportPct = (exportSales / totalDomesticExport) * 100;

  const salesSafe = totalSalesAll || 1;

  const operatingMargin = totalSalesAll ? (operatingIncome / totalSalesAll) * 100 : 0;
  const netMargin = totalSalesAll ? (netIncome / totalSalesAll) * 100 : 0;

  const cogs = getValue("매출원가계");
  const sga = getValue("판매비와일반관리비");
  const gross = getValue("매출총이익");

  const cogsRatio = totalSalesAll ? (cogs / totalSalesAll) * 100 : 0;
  const sgaRatio = totalSalesAll ? (sga / totalSalesAll) * 100 : 0;
  const grossMargin = totalSalesAll ? (gross / totalSalesAll) * 100 : 0;

  // -----------------------------
  // ✅ 상단 문구
  // -----------------------------
  const summaryText = useMemo(() => {
    const condLabel = selectedCond === "전체" ? "전체" : `${selectedCond} 기준(전체)`;

    const opSign = operatingIncome >= 0 ? "흑자" : "적자";
    const netSign = netIncome >= 0 ? "흑자" : "적자";

    const domExpTxt = `국내 ${domesticPct.toFixed(1)}% / 수출 ${exportPct.toFixed(1)}%`;

    return `당월 손익 지표 요약 (${condLabel}): 매출 ${formatNumber(totalSalesAll)}원 · 영업이익 ${formatNumber(operatingIncome)}원(${opSign}, ${operatingMargin.toFixed(
      1
    )}%) · 순이익 ${formatNumber(netIncome)}원(${netSign}, ${netMargin.toFixed(1)}%) · 매출구조(${domExpTxt}) · 원가율 ${cogsRatio.toFixed(1)}% · 판관비율 ${sgaRatio.toFixed(
      1
    )}% · GPM ${grossMargin.toFixed(1)}%`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCond, totalSalesAll, operatingIncome, netIncome, operatingMargin, netMargin, domesticPct, exportPct, cogsRatio, sgaRatio, grossMargin]);

  // -----------------------------
  // 1) 손익 구조 시리즈
  // -----------------------------
  const kpiSeries = useMemo(() => {
    return KPI_ORDER.map((name) => ({
      name,
      value: getValue(name),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, summaryColName]);

  // -----------------------------
  // 2) 대표 지표 비율 (전체)
  // -----------------------------
  const ratioItems = useMemo(() => {
    const meta = [
      { key: "매출원가계", label: "매출원가율", sub: "COGS / Sales", formula: "매출원가계 ÷ 매출액", value: getValue("매출원가계"), tone: "blue" },
      { key: "매출총이익", label: "매출총이익률", sub: "Gross Margin", formula: "매출총이익 ÷ 매출액", value: getValue("매출총이익"), tone: "green" },
      { key: "판매비와일반관리비", label: "판관비율", sub: "SG&A / Sales", formula: "판관비 ÷ 매출액", value: getValue("판매비와일반관리비"), tone: "indigo" },
      { key: "영업이익", label: "영업이익률", sub: "Operating", formula: "영업이익 ÷ 매출액", value: getValue("영업이익"), tone: "teal" },
      { key: "당기순이익", label: "순이익률", sub: "Net", formula: "당기순이익 ÷ 매출액", value: getValue("당기순이익"), tone: "sky" },
    ];

    const toneColor = (tone) => {
      if (tone === "blue") return "#2563eb";
      if (tone === "green") return "#16a34a";
      if (tone === "indigo") return "#4f46e5";
      if (tone === "teal") return "#0f766e";
      if (tone === "sky") return "#0ea5e9";
      return "#64748b";
    };

    return meta.map((it) => {
      const ratio = (it.value / salesSafe) * 100;
      return {
        ...it,
        ratio,
        ratioAbs: Math.max(0, Math.min(Math.abs(ratio), 100)),
        color: toneColor(it.tone),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, summaryColName, totalSalesAll]);

  // -----------------------------
  // 3) ✅ 조건 화면 KPI Top10
  // -----------------------------
  const conditionKpiTop10 = useMemo(() => {
    if (selectedCond === "전체") return null;
    return {
      매출액: getConditionTop10ByItem("매출액"),
      매출원가계: getConditionTop10ByItem("매출원가계"),
      매출총이익: getConditionTop10ByItem("매출총이익"),
      판매비와일반관리비: getConditionTop10ByItem("판매비와일반관리비"),
      영업이익: getConditionTop10ByItem("영업이익"),
      영업외수익: getConditionTop10ByItem("영업외수익"),
      영업외비용: getConditionTop10ByItem("영업외비용"),
      당기순이익: getConditionTop10ByItem("당기순이익"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedCond, hasData]);

  const conditionDomesticTop10 = useMemo(() => {
    if (selectedCond === "전체") return { total: 0, items: [] };
    return getConditionTop10ByItem("국내매출액");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedCond, hasData]);

  const conditionExportTop10 = useMemo(() => {
    if (selectedCond === "전체") return { total: 0, items: [] };
    return getConditionTop10ByItem("수출매출액");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedCond, hasData]);

  // -----------------------------
  // ✅ 조건 화면 공통 색상 맵
  // -----------------------------
  const conditionColorMap = useMemo(() => {
    if (selectedCond === "전체") return {};

    const order = [];
    const seen = new Set();

    const pushCodes = (items = []) => {
      items.forEach((it) => {
        if (!it || !it.code) return;
        if (seen.has(it.code)) return;
        seen.add(it.code);
        order.push(it.code);
      });
    };

    pushCodes(conditionKpiTop10?.["매출액"]?.items || []);
    KPI_ORDER.forEach((kpi) => pushCodes(conditionKpiTop10?.[kpi]?.items || []));
    pushCodes(conditionDomesticTop10?.items || []);
    pushCodes(conditionExportTop10?.items || []);

    const map = {};
    order.forEach((code, idx) => {
      map[code] = colorFromIndex(idx);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCond, conditionKpiTop10, conditionDomesticTop10, conditionExportTop10]);

  const getCodeColor = (code) => conditionColorMap?.[code] || "#94a3b8";

  // -----------------------------
  // 4) 4-1~4-4 세부항목 + 조건 세부코드 선택
  // -----------------------------
  const conditionDetailCodes = useMemo(() => {
    if (!hasData || selectedCond === "전체") return [];

    const prefix = `${selectedCond}_`;
    const totalCol = `${selectedCond}_전체`;
    const cols = Object.keys(rows[0] || {}).filter((c) => c.startsWith(prefix) && c !== totalCol);
    const codes = cols.map((c) => c.replace(prefix, ""));

    return codes
      .map((code) => ({
        code,
        label: `${getCodeLabel(selectedCond, code)} (${code})`,
        col: `${selectedCond}_${code}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko-KR"));
  }, [hasData, rows, selectedCond]);

  const [detailPick41, setDetailPick41] = useState("전체");
  const [detailPick42, setDetailPick42] = useState("전체");
  const [detailPick43, setDetailPick43] = useState("전체");
  const [detailPick44, setDetailPick44] = useState("전체");

  useEffect(() => {
    setDetailPick41("전체");
    setDetailPick42("전체");
    setDetailPick43("전체");
    setDetailPick44("전체");
  }, [selectedCond]);

  const getDetailCol = (pick) => {
    if (selectedCond === "전체") return summaryColName;
    if (!pick || pick === "전체") return `${selectedCond}_전체`;
    return `${selectedCond}_${pick}`;
  };

  const detailCol41 = getDetailCol(detailPick41);
  const detailCol42 = getDetailCol(detailPick42);
  const detailCol43 = getDetailCol(detailPick43);
  const detailCol44 = getDetailCol(detailPick44);

  const cogsDetailTop10 = useMemo(() => getDetailGroup("매출원가계", 10, detailCol41), [rows, hasData, detailCol41]); // eslint-disable-line
  const sgaDetailTop10 = useMemo(() => getDetailGroup("판매비와일반관리비", 10, detailCol42), [rows, hasData, detailCol42]); // eslint-disable-line
  const nonOpIncomeDetailTop10 = useMemo(() => getDetailGroup("영업외수익", 10, detailCol43), [rows, hasData, detailCol43]); // eslint-disable-line
  const nonOpExpenseDetailTop10 = useMemo(() => getDetailGroup("영업외비용", 10, detailCol44), [rows, hasData, detailCol44]); // eslint-disable-line

  // (전체 화면용) 국내/수출 세부 항목
  const domesticDetail = useMemo(() => getDetailGroup("국내매출액", 10, summaryColName), [rows, summaryColName, hasData]); // eslint-disable-line
  const exportDetail = useMemo(() => getDetailGroup("수출매출액", 10, summaryColName), [rows, summaryColName, hasData]); // eslint-disable-line

  const domesticItemsFiltered = domesticDetail.items.filter((it) => !it.name.includes("판매수량"));
  const exportItemsFiltered = exportDetail.items.filter((it) => !it.name.includes("판매수량"));

  // -----------------------------
  // 데이터 없을 때
  // -----------------------------
  if (!hasData) {
    return (
      <div style={{ padding: "16px 0 4px", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        <p>그래프로 시각화할 데이터가 없습니다.</p>
      </div>
    );
  }

  /* ============================
   * ✅ UI 토큰
   * ============================ */
  const UI = {
    pageBg: "linear-gradient(180deg, rgba(241,245,249,1) 0%, rgba(248,250,252,1) 35%, rgba(255,255,255,1) 100%)",
    cardShadow: "0 18px 45px rgba(15,23,42,0.06)",
    softShadow: "0 10px 26px rgba(15,23,42,0.06)",
    border: "1px solid rgba(226,232,240,0.95)",
    radiusXL: 22,
    radiusL: 18,
    radiusM: 14,
    text: "#0f172a",
    sub: "#475569",
    mute: "#94a3b8",
  };

  /* ============================
   * ✅ “줄마다 꽉 차게” 레이아웃 유틸
   *  - flex wrap 대신 grid(auto-fit)로 바꿔서
   *    남는 공간 없이 매 줄 꽉 채우도록 개선
   * ============================ */
  const GridRow = ({ min = 340, gap = 14, children }) => (
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap,
        alignItems: "stretch",
      }}
    >
      {children}
    </div>
  );

  /* ============================
   * ✅ 고급 카드/헤더 컴포넌트
   * ============================ */
  const Card = ({ title, kicker, right, children, tone = "slate" }) => {
    const toneGrad = (t) => {
      if (t === "blue") return "linear-gradient(135deg, rgba(37,99,235,0.14), rgba(37,99,235,0.04))";
      if (t === "green") return "linear-gradient(135deg, rgba(22,163,74,0.14), rgba(22,163,74,0.04))";
      if (t === "indigo") return "linear-gradient(135deg, rgba(79,70,229,0.14), rgba(79,70,229,0.04))";
      if (t === "teal") return "linear-gradient(135deg, rgba(15,118,110,0.14), rgba(15,118,110,0.04))";
      if (t === "sky") return "linear-gradient(135deg, rgba(14,165,233,0.14), rgba(14,165,233,0.04))";
      return "linear-gradient(135deg, rgba(15,23,42,0.10), rgba(15,23,42,0.03))";
    };

    return (
      <div
        style={{
          width: "100%",
          background: "#fff",
          borderRadius: UI.radiusXL,
          border: UI.border,
          boxShadow: UI.cardShadow,
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div style={{ padding: "16px 18px 14px", background: toneGrad(tone), borderBottom: "1px solid rgba(226,232,240,0.9)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              {kicker && <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, letterSpacing: 0.2 }}>{kicker}</div>}
              {title && <div style={{ fontSize: 16, fontWeight: 900, color: UI.text, marginTop: 4 }}>{title}</div>}
            </div>
            {right && <div style={{ flex: "0 0 auto" }}>{right}</div>}
          </div>
        </div>
        <div style={{ padding: "16px 18px 18px" }}>{children}</div>
      </div>
    );
  };

  const Pill = ({ text, tone = "slate" }) => {
    const bg = tone === "green" ? "rgba(22,163,74,0.12)" : tone === "red" ? "rgba(185,28,28,0.12)" : tone === "blue" ? "rgba(37,99,235,0.12)" : "rgba(15,23,42,0.08)";
    const fg = tone === "green" ? "#166534" : tone === "red" ? "#991b1b" : tone === "blue" ? "#1d4ed8" : "#334155";
    return (
      <span style={{ padding: "6px 10px", borderRadius: 999, background: bg, color: fg, fontSize: 12, fontWeight: 900, border: "1px solid rgba(226,232,240,0.95)" }}>
        {text}
      </span>
    );
  };

  /* ============================
   * ✅ 게이지(마진)
   * ============================ */
  const Gauge = ({ value, label }) => {
    const v = Math.max(-30, Math.min(60, Number(value) || 0));
    const pct = (v + 30) / 90; // 0~1
    const deg = -120 + pct * 240; // -120~120
    const tone = v < 0 ? "red" : v < 5 ? "blue" : "green";

    const dot = tone === "red" ? "#b91c1c" : tone === "blue" ? "#2563eb" : "#16a34a";
    const ring = "rgba(148,163,184,0.25)";

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ width: 130, height: 78, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 8,
              width: 130,
              height: 130,
              borderRadius: "50%",
              background: `conic-gradient(${dot} 0 24%, rgba(37,99,235,0.35) 24% 58%, rgba(22,163,74,0.35) 58% 100%)`,
              clipPath: "inset(0 0 40% 0)",
              opacity: 0.45,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 10,
              top: 18,
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: ring,
              clipPath: "inset(0 0 40% 0)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 65,
              top: 73,
              width: 2,
              height: 45,
              background: "#0f172a",
              borderRadius: 999,
              transformOrigin: "bottom center",
              transform: `rotate(${deg}deg) translateY(-6px)`,
              transition: "transform 0.5s ease",
              boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 58,
              top: 74,
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#fff",
              border: `3px solid ${dot}`,
              boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: v < 0 ? "#b91c1c" : "#0f172a" }}>{formatRate(v)}</div>
      </div>
    );
  };

  /* ============================
   * ✅ 도넛(대표비율)
   * ============================ */
  const Donut = ({ ratioAbs, label, sub, ratioText, formula, color }) => {
    const clamped = Math.max(0, Math.min(ratioAbs, 100));
    const bg = `conic-gradient(${color} ${clamped}%, rgba(226,232,240,1) 0)`;
    return (
      <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 168,
            height: 168,
            borderRadius: "50%",
            background: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 16px 34px rgba(15,23,42,0.10)",
            border: "1px solid rgba(226,232,240,0.95)",
          }}
        >
          <div
            style={{
              width: 122,
              height: 122,
              borderRadius: "50%",
              background: "linear-gradient(180deg, #ffffff, #f8fafc)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 950,
              color: "#0f172a",
              textAlign: "center",
              border: "1px solid rgba(226,232,240,0.95)",
            }}
          >
            {ratioText}
            <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginTop: 2 }}>{sub}</div>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 950, color: "#111827", textAlign: "center" }}>{label}</div>
        {formula && <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", whiteSpace: "nowrap" }}>{formula}</div>}
      </div>
    );
  };

  /* ============================
   * ✅ 워터폴
   * ============================ */
  const WaterfallPL = ({ width = 980, height = 220 }) => {
    const steps = [
      { key: "매출액", label: "매출", value: totalSalesAll, kind: "base" },
      { key: "매출원가계", label: "원가", value: -Math.abs(cogs), kind: "delta" },
      { key: "매출총이익", label: "매출총이익", value: gross, kind: "total" },
      { key: "판매비와일반관리비", label: "판관비", value: -Math.abs(sga), kind: "delta" },
      { key: "영업이익", label: "영업이익", value: operatingIncome, kind: "total" },
      { key: "영업외수익", label: "영업외수익", value: Math.abs(getValue("영업외수익")), kind: "delta" },
      { key: "영업외비용", label: "영업외비용", value: -Math.abs(getValue("영업외비용")), kind: "delta" },
      { key: "당기순이익", label: "순이익", value: netIncome, kind: "total" },
    ];

    let cum = 0;
    const points = steps.map((s, idx) => {
      if (idx === 0) {
        cum = s.value;
        return { ...s, from: 0, to: cum };
      }
      if (s.kind === "delta") {
        const from = cum;
        cum = cum + s.value;
        return { ...s, from, to: cum };
      }
      const from = 0;
      cum = s.value;
      return { ...s, from, to: cum };
    });

    const maxAbs = Math.max(...points.map((p) => Math.max(Math.abs(p.from), Math.abs(p.to))), 1);
    const pad = 20;
    const w = width;
    const h = height;

    const chartW = w - pad * 2;
    const chartH = h - pad * 2 - 26;
    const zeroY = pad + chartH / 2;
    const scale = (chartH / 2) / maxAbs;

    const barW = chartW / points.length - 10;
    const gap = 10;

    const yOf = (v) => zeroY - v * scale;

    const toneFor = (p) => {
      if (p.kind === "total") return p.to >= 0 ? "#16a34a" : "#b91c1c";
      return p.value >= 0 ? "#2563eb" : "#e11d48";
    };

    return (
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg width={w} height={h} style={{ display: "block" }}>
          <defs>
            <linearGradient id="wfBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#f8fafc" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={w} height={h} rx="18" fill="url(#wfBg)" stroke="rgba(226,232,240,0.95)" />
          {[ -1, -0.5, 0, 0.5, 1 ].map((k) => {
            const yy = zeroY - k * (chartH / 2);
            return <line key={k} x1={pad} y1={yy} x2={w - pad} y2={yy} stroke="rgba(148,163,184,0.25)" strokeWidth="1" />;
          })}
          <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="rgba(15,23,42,0.35)" strokeWidth="1.2" />

          {points.map((p, i) => {
            const x = pad + i * (barW + gap) + gap;
            const y1 = yOf(p.from);
            const y2 = yOf(p.to);
            const top = Math.min(y1, y2);
            const barH = Math.max(6, Math.abs(y2 - y1));
            const color = toneFor(p);

            const prev = points[i - 1];
            const prevX = pad + (i - 1) * (barW + gap) + gap + barW;
            const prevY = prev ? yOf(prev.to) : zeroY;

            return (
              <g key={p.key}>
                {i > 0 && (
                  <line x1={prevX} y1={prevY} x2={x} y2={y1} stroke="rgba(148,163,184,0.55)" strokeWidth="2" strokeDasharray={p.kind === "total" ? "5 5" : "0"} />
                )}
                <rect x={x} y={top} width={barW} height={barH} rx="10" fill={color} opacity="0.92" />
                <rect x={x} y={top} width={barW} height={barH} rx="10" fill="#ffffff" opacity="0.06" />
                <text x={x + barW / 2} y={top - 8} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">
                  {formatSigned(p.kind === "delta" ? p.value : p.to)}
                </text>
                <text x={x + barW / 2} y={h - 14} textAnchor="middle" fontSize="11" fontWeight="900" fill="#334155">
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  /* ============================
   * ✅ 세그먼트 바
   * ============================ */
  const SegmentedBar = ({ items, getColor, height = 16 }) => {
    const safeItems = (items || []).filter((it) => (Number(it.share) || 0) > 0);
    if (safeItems.length === 0) return <div style={{ height, borderRadius: 999, background: "#f1f5f9" }} />;

    let sum = safeItems.reduce((s, it) => s + (Number(it.share) || 0), 0);
    if (!sum) sum = 1;

    return (
      <div style={{ height, borderRadius: 999, background: "#f1f5f9", overflow: "hidden", display: "flex", border: "1px solid rgba(226,232,240,0.95)" }}>
        {safeItems.map((it) => {
          const pct = (Number(it.share) || 0) / sum;
          const widthPct = Math.max(pct * 100, 0);
          const minPx = 2;
          return (
            <div
              key={it.col || it.code || it.name}
              title={`${it.label || it.name} (${(Number(it.share) || 0).toFixed(1)}%)`}
              style={{
                width: `${widthPct}%`,
                minWidth: minPx,
                background: getColor(it),
              }}
            />
          );
        })}
      </div>
    );
  };

  const LollipopEnd = ({ leftPct, color }) => (
    <div
      style={{
        position: "absolute",
        left: `calc(${leftPct}% - 6px)`,
        top: "50%",
        transform: "translateY(-50%)",
        width: 12,
        height: 12,
        borderRadius: 999,
        background: "#ffffff",
        border: `3px solid ${color}`,
        boxSizing: "border-box",
        boxShadow: "0 10px 18px rgba(15,23,42,0.12)",
      }}
    />
  );

  /* ============================
   * ✅ 조건 Top10 카드
   * ============================ */
  const RankTop10Card = ({ title, data }) => {
    const items = data?.items || [];
    const total = data?.total || 0;

    return (
      <div
        style={{
          width: "100%",
          minWidth: 0,
          borderRadius: UI.radiusL,
          border: UI.border,
          background: "linear-gradient(180deg, #ffffff, #f8fafc)",
          boxShadow: UI.softShadow,
          padding: "14px 14px 12px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>{title} Top 10</div>
          <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", fontWeight: 900 }}>합계 {formatNumber(total)}</div>
        </div>

        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 10 }}>데이터가 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {items.map((it, idx) => {
              const color = getCodeColor(it.code);
              const widthPct = Math.min(it.share, 100);
              const rankTone = idx === 0 ? "gold" : idx < 3 ? "blue" : "slate";

              return (
                <div key={it.col} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "#475569" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 22,
                          height: 18,
                          borderRadius: 10,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 950,
                          border: "1px solid rgba(226,232,240,0.95)",
                          background:
                            rankTone === "gold"
                              ? "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.10))"
                              : rankTone === "blue"
                              ? "linear-gradient(135deg, rgba(37,99,235,0.22), rgba(37,99,235,0.08))"
                              : "linear-gradient(135deg, rgba(15,23,42,0.10), rgba(15,23,42,0.04))",
                          color: "#0f172a",
                        }}
                      >
                        {idx + 1}
                      </span>

                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: color, flex: "0 0 auto", boxShadow: "0 10px 18px rgba(15,23,42,0.12)" }} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.label} <span style={{ color: "#94a3b8" }}>({it.code})</span>
                        </span>
                      </span>
                    </span>
                    <span style={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                      {formatNumber(it.value)} <span style={{ color: "#64748b", fontWeight: 800 }}>({it.share.toFixed(1)}%)</span>
                    </span>
                  </div>

                  <div style={{ position: "relative", height: 22 }}>
                    <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "100%", height: 7, borderRadius: 999, background: "#eef2ff" }} />
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: `${widthPct}%`,
                        height: 7,
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.55))`,
                        transition: "width 0.35s ease",
                      }}
                    />
                    <LollipopEnd leftPct={widthPct} color={color} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const ConditionSegmentWithList = ({ title, data }) => {
    const items = data?.items || [];
    const total = data?.total || 0;

    return (
      <div
        style={{
          width: "100%",
          minWidth: 0,
          borderRadius: UI.radiusL,
          border: UI.border,
          padding: "14px 14px 12px",
          background: "linear-gradient(180deg, #ffffff, #f8fafc)",
          boxShadow: UI.softShadow,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>{title} Top 10</div>
          <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", fontWeight: 900 }}>합계 {formatNumber(total)}</div>
        </div>

        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>데이터가 없습니다.</div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Top10 구성 비중(누적)</div>
              <SegmentedBar items={items} getColor={(it) => getCodeColor(it.code)} height={18} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Top 10 상세</div>

              {items.map((it) => {
                const color = getCodeColor(it.code);
                const widthPct = Math.min(it.share, 100);

                return (
                  <div key={it.col} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "#475569" }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: color, flex: "0 0 auto", boxShadow: "0 10px 18px rgba(15,23,42,0.12)" }} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.label} <span style={{ color: "#94a3b8" }}>({it.code})</span>
                        </span>
                      </span>
                      <span style={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                        {formatNumber(it.value)} <span style={{ color: "#64748b", fontWeight: 800 }}>({it.share.toFixed(1)}%)</span>
                      </span>
                    </div>

                    <div style={{ position: "relative", height: 22 }}>
                      <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "100%", height: 7, borderRadius: 999, background: "#f1f5f9" }} />
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: `${widthPct}%`,
                          height: 7,
                          borderRadius: 999,
                          background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.55))`,
                        }}
                      />
                      <LollipopEnd leftPct={widthPct} color={color} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const TotalSalesDetailSegment = ({ title, totalValue, items }) => {
    const safeItems = items || [];
    return (
      <div style={{ width: "100%", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 950, color: "#0f172a" }}>{title}</div>
          <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", fontWeight: 900 }}>세부합계 {formatNumber(totalValue)}</div>
        </div>

        {safeItems.length === 0 ? (
          <div style={{ fontSize: 13, color: "#94a3b8" }}>{title} 세부 항목 데이터가 없습니다.</div>
        ) : (
          <>
            <SegmentedBar items={safeItems.map((it) => ({ ...it, col: it.name }))} getColor={(it) => getShareColor(Number(it.share) || 0)} height={18} />

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
              {safeItems.map((it) => (
                <div key={it.name} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    <span style={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                      {formatNumber(it.value)} <span style={{ color: "#64748b", fontWeight: 800 }}>({it.share.toFixed(1)}%)</span>
                    </span>
                  </div>

                  <div style={{ position: "relative", height: 22 }}>
                    <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "100%", height: 7, borderRadius: 999, background: "#f1f5f9" }} />
                    <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: `${Math.min(it.share, 100)}%`, height: 7, borderRadius: 999, background: getShareColor(it.share) }} />
                    <LollipopEnd leftPct={Math.min(it.share, 100)} color={getShareColor(it.share)} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  /* ============================
   * ✅ (교체) 국내/수출 그래프: 도넛 → “듀얼 바 + 스택바”
   * ============================ */
  const DomExpBar = () => {
    const dom = Math.max(0, domesticSales);
    const exp = Math.max(0, exportSales);
    const sum = dom + exp || 1;

    const domPct = (dom / sum) * 100;
    const expPct = (exp / sum) * 100;

    const maxV = Math.max(dom, exp, 1);
    const domW = (dom / maxV) * 100;
    const expW = (exp / maxV) * 100;

    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* 스택바(비중) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#0f172a" }}>매출구조 (국내/수출)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill text={`국내 ${domPct.toFixed(1)}%`} tone="blue" />
            <Pill text={`수출 ${expPct.toFixed(1)}%`} tone="green" />
            <Pill text={`총 ${formatNumber(sum)}`} tone="slate" />
          </div>
        </div>

        <div style={{ width: "100%", height: 18, borderRadius: 999, overflow: "hidden", background: "#f1f5f9", border: UI.border, display: "flex" }}>
          <div style={{ width: `${domPct}%`, background: "linear-gradient(90deg, #3b82f6, rgba(59,130,246,0.35))" }} title={`국내 ${domPct.toFixed(1)}%`} />
          <div style={{ width: `${expPct}%`, background: "linear-gradient(90deg, #10b981, rgba(16,185,129,0.35))" }} title={`수출 ${expPct.toFixed(1)}%`} />
        </div>

        {/* 듀얼 바(금액 비교) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { key: "dom", label: "국내매출", value: dom, pct: domPct, w: domW, color: "#3b82f6" },
            { key: "exp", label: "수출매출", value: exp, pct: expPct, w: expW, color: "#10b981" },
          ].map((b) => (
            <div key={b.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "#475569" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: b.color, flex: "0 0 auto" }} />
                  <span style={{ fontWeight: 950, color: "#0f172a" }}>{b.label}</span>
                  <span style={{ color: "#94a3b8", fontWeight: 900 }}>{b.pct.toFixed(1)}%</span>
                </span>
                <span style={{ whiteSpace: "nowrap", fontWeight: 950, color: "#0f172a" }}>{formatNumber(b.value)}</span>
              </div>
              <div style={{ position: "relative", height: 12, borderRadius: 999, overflow: "hidden", background: "#f1f5f9", border: UI.border }}>
                <div style={{ width: `${Math.max(2, b.w)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${b.color}, rgba(255,255,255,0.55))` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // -----------------------------
  // 렌더
  // -----------------------------
  return (
    <div
      style={{
        padding: "18px 14px 10px", // ✅ 좌우 패딩을 줘서 “줄 꽉 참 + 보기 좋은 정렬”
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        background: UI.pageBg,
        borderRadius: 18,
      }}
    >
      {/* 상단 제목/정보 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "0 2px", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 950, color: "#0f172a" }}>결산보고서 — Executive Graph Dashboard</h2>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, fontWeight: 800 }}>
            선택된 조건:&nbsp;
            <b style={{ color: "#0f172a" }}>{selectedCond === "전체" ? "전체" : `${selectedCond} - 전체`}</b>
            {selectedYear && selectedMonth && (
              <>
                &nbsp;| 조회 기간:&nbsp;
                <span style={{ fontWeight: 950, color: "#0f172a" }}>
                  {selectedYear}년 {String(selectedMonth).padStart(2, "0")}월
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Pill text={selectedCond === "전체" ? "MODE: OVERVIEW" : "MODE: SEGMENT"} tone={selectedCond === "전체" ? "blue" : "slate"} />
          <Pill text={operatingIncome >= 0 ? "영업 흑자" : "영업 적자"} tone={operatingIncome >= 0 ? "green" : "red"} />
          <Pill text={`OPM ${formatRate(operatingMargin)}`} tone={operatingMargin >= 0 ? "blue" : "red"} />
        </div>
      </div>

      {/* 요약 문구 */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,1), rgba(248,250,252,1))",
          borderRadius: UI.radiusL,
          border: UI.border,
          padding: "12px 14px",
          boxShadow: UI.softShadow,
          fontSize: 13,
          color: "#334155",
          lineHeight: 1.6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 950, color: "#0f172a" }}>당월 손익 지표 요약</span>
          <span style={{ color: "#94a3b8", fontWeight: 900 }}>— 자동 생성 인사이트 문장(보고서용)</span>
        </div>
        <div style={{ marginTop: 6 }}>{summaryText}</div>
      </div>

      {/* 상단 KPI 3 카드: ✅ grid로 “줄마다 꽉 차게” */}
      <GridRow min={340} gap={14}>
        <Card tone="blue" kicker="Revenue" title="당월 매출액 (선택 조건)" right={<Pill text={`국내 ${domesticPct.toFixed(1)}%`} tone="blue" />}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 28, fontWeight: 950, color: "#0f172a", letterSpacing: -0.3 }}>{formatNumber(totalSalesAll)} 원</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>국내</div>
                <div style={{ fontSize: 16, fontWeight: 950, color: "#0f172a" }}>{formatNumber(domesticSales)}</div>
              </div>
              <div style={{ width: 1, background: "rgba(226,232,240,0.95)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>수출</div>
                <div style={{ fontSize: 16, fontWeight: 950, color: "#0f172a" }}>{formatNumber(exportSales)}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card tone={operatingIncome >= 0 ? "green" : "slate"} kicker="Operating" title="영업이익" right={<Pill text={operatingIncome >= 0 ? "흑자" : "적자"} tone={operatingIncome >= 0 ? "green" : "red"} />}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 26, fontWeight: 950, color: operatingIncome >= 0 ? "#16a34a" : "#b91c1c" }}>{formatNumber(operatingIncome)} 원</div>
            <Gauge value={operatingMargin} label="영업이익률" />
          </div>
        </Card>

        <Card tone={netIncome >= 0 ? "sky" : "slate"} kicker="Net" title="당기순이익" right={<Pill text={`NPM ${formatRate(netMargin)}`} tone={netMargin >= 0 ? "blue" : "red"} />}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 26, fontWeight: 950, color: netIncome >= 0 ? "#16a34a" : "#b91c1c" }}>{formatNumber(netIncome)} 원</div>
            <Gauge value={netMargin} label="순이익률" />
          </div>
        </Card>
      </GridRow>

      {/* 전체: 대표 지표 비율 + 워터폴 (✅ grid로 꽉 채움) */}
      {selectedCond === "전체" && (
        <GridRow min={520} gap={14}>
          <Card tone="indigo" kicker="Ratios" title="대표 경영지표 — 매출 대비 비율(Executive)" right={<Pill text="원가/이익 구조 즉시 파악" tone="blue" />}>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap", justifyContent: "space-between" }}>
              {ratioItems.map((it) => {
                const ratioText = `${it.ratio.toFixed(1)}%`;
                return <Donut key={it.key} ratioAbs={it.ratioAbs} label={it.label} sub={it.sub} ratioText={ratioText} formula={it.formula} color={it.color} />;
              })}
            </div>
          </Card>

          <Card tone="slate" kicker="Bridge" title="손익 워터폴 — 매출 → 원가/판관비 → 순이익" right={<Pill text="P/L 흐름을 1장으로" tone="slate" />}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>(+)는 개선/증가, (-)는 차감 항목이며, Total 단계(매출총이익/영업이익/순이익)는 해당 금액 자체를 표시합니다.</div>
              <WaterfallPL />
            </div>
          </Card>
        </GridRow>
      )}

      {/* 조건: KPI Top10 */}
      {selectedCond !== "전체" && (
        <Card tone="slate" kicker="Segment" title={`조건별 손익 KPI Top 10 — ${selectedCond}`} right={<Pill text="코드별 기여도 랭킹" tone="blue" />}>
          <GridRow min={360} gap={12}>
            {KPI_ORDER.map((kpi) => (
              <RankTop10Card key={kpi} title={kpi} data={conditionKpiTop10?.[kpi]} />
            ))}
          </GridRow>
        </Card>
      )}

      {/* 전체: 매출 구조 (✅ 그래프 교체: DomExpDonut → DomExpBar) */}
      {selectedCond === "전체" && (
        <Card tone="blue" kicker="Sales Mix" title="매출 구조 — 국내/수출 비중 & 세부 구성" right={<Pill text="구성 변화 감지에 유리" tone="blue" />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DomExpBar />
            <GridRow min={420} gap={22}>
              <TotalSalesDetailSegment title="국내매출 세부 항목" totalValue={domesticDetail.total} items={domesticItemsFiltered} />
              <TotalSalesDetailSegment title="수출매출 세부 항목" totalValue={exportDetail.total} items={exportItemsFiltered} />
            </GridRow>
          </div>
        </Card>
      )}

      {/* 조건: 국내/수출 Top10 */}
      {selectedCond !== "전체" && (
        <Card tone="blue" kicker="Sales Mix" title={`조건별 국내/수출 매출 Top 10 — ${selectedCond}`} right={<Pill text="Top10 누적 + 상세" tone="blue" />}>
          <GridRow min={520} gap={12}>
            <ConditionSegmentWithList title="국내매출액" data={conditionDomesticTop10} />
            <ConditionSegmentWithList title="수출매출액" data={conditionExportTop10} />
          </GridRow>
        </Card>
      )}

      {/* 4-1~4-4 세부 Top10 (✅ grid로 줄 꽉 차게) */}
      <GridRow min={520} gap={14}>
        <Card
          tone="blue"
          kicker="Cost Driver"
          title="4-1. 매출원가 세부 항목 Top 10"
          right={
            selectedCond !== "전체" ? (
              <select
                value={detailPick41}
                onChange={(e) => setDetailPick41(e.target.value)}
                style={{ fontSize: 12, padding: "7px 10px", borderRadius: 12, border: UI.border, color: "#0f172a", background: "#fff", maxWidth: 260, fontWeight: 900 }}
              >
                <option value="전체">전체(조건_전체)</option>
                {conditionDetailCodes.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Pill text="OVERALL" tone="blue" />
            )
          }
        >
          {cogsDetailTop10.items.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>"매출원가계" 하위 세부 항목 데이터가 없습니다.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cogsDetailTop10.items.map((it) => (
                <div key={it.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    <span style={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                      {formatNumber(it.value)} <span style={{ color: "#64748b", fontWeight: 800 }}>({it.share.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 9, borderRadius: 999, background: "#f1f5f9", overflow: "hidden", border: UI.border }}>
                    <div style={{ width: `${Math.min(it.share, 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${getShareColor(it.share)}, rgba(255,255,255,0.6))` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          tone="indigo"
          kicker="SG&A Driver"
          title="4-2. 판관비 세부 항목 Top 10"
          right={
            selectedCond !== "전체" ? (
              <select
                value={detailPick42}
                onChange={(e) => setDetailPick42(e.target.value)}
                style={{ fontSize: 12, padding: "7px 10px", borderRadius: 12, border: UI.border, color: "#0f172a", background: "#fff", maxWidth: 260, fontWeight: 900 }}
              >
                <option value="전체">전체(조건_전체)</option>
                {conditionDetailCodes.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Pill text="OVERALL" tone="blue" />
            )
          }
        >
          {sgaDetailTop10.items.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>판관비 관련 세부 항목 데이터가 없습니다.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sgaDetailTop10.items.map((it) => (
                <div key={it.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    <span style={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                      {formatNumber(it.value)} <span style={{ color: "#64748b", fontWeight: 800 }}>({it.share.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 9, borderRadius: 999, background: "#f1f5f9", overflow: "hidden", border: UI.border }}>
                    <div style={{ width: `${Math.min(it.share, 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${getShareColor(it.share)}, rgba(255,255,255,0.6))` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          tone="teal"
          kicker="Non-Op Income"
          title="4-3. 영업외수익 세부 항목 Top 10"
          right={
            selectedCond !== "전체" ? (
              <select
                value={detailPick43}
                onChange={(e) => setDetailPick43(e.target.value)}
                style={{ fontSize: 12, padding: "7px 10px", borderRadius: 12, border: UI.border, color: "#0f172a", background: "#fff", maxWidth: 260, fontWeight: 900 }}
              >
                <option value="전체">전체(조건_전체)</option>
                {conditionDetailCodes.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Pill text="OVERALL" tone="blue" />
            )
          }
        >
          {nonOpIncomeDetailTop10.items.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>영업외수익 관련 세부 항목 데이터가 없습니다.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {nonOpIncomeDetailTop10.items.map((it) => (
                <div key={it.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    <span style={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                      {formatNumber(it.value)} <span style={{ color: "#64748b", fontWeight: 800 }}>({it.share.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 9, borderRadius: 999, background: "#f1f5f9", overflow: "hidden", border: UI.border }}>
                    <div style={{ width: `${Math.min(it.share, 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${getShareColor(it.share)}, rgba(255,255,255,0.6))` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          tone="slate"
          kicker="Non-Op Expense"
          title="4-4. 영업외비용 세부 항목 Top 10"
          right={
            selectedCond !== "전체" ? (
              <select
                value={detailPick44}
                onChange={(e) => setDetailPick44(e.target.value)}
                style={{ fontSize: 12, padding: "7px 10px", borderRadius: 12, border: UI.border, color: "#0f172a", background: "#fff", maxWidth: 260, fontWeight: 900 }}
              >
                <option value="전체">전체(조건_전체)</option>
                {conditionDetailCodes.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Pill text="OVERALL" tone="blue" />
            )
          }
        >
          {nonOpExpenseDetailTop10.items.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>영업외비용 관련 세부 항목 데이터가 없습니다.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {nonOpExpenseDetailTop10.items.map((it) => (
                <div key={it.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    <span style={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                      {formatNumber(it.value)} <span style={{ color: "#64748b", fontWeight: 800 }}>({it.share.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 9, borderRadius: 999, background: "#f1f5f9", overflow: "hidden", border: UI.border }}>
                    <div style={{ width: `${Math.min(it.share, 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${getShareColor(it.share)}, rgba(255,255,255,0.6))` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </GridRow>

      <div style={{ height: 4 }} />
    </div>
  );
}

export default PlReportGraphTab;
