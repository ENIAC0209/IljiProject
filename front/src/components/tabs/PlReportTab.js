// front/coProject-main/sapcoproject/src/components/tabs/PlReportTab.js

import React, { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx"; // ✅ 엑셀 Export용 추가
import PlReportGraphTab from "./PlReportGraphTab"; // 그래프 탭 컴포넌트

const CONDITION_KEYS = [
  "전체",
  "플랜트",
  "대표차종",
  "유통경로",
  "판매문서유형",
  "기타매출유형",
  "레코드유형",
  "평가클래스",
  "Prod.계층구조01-2",
  "손익센터",
];

// 🔹 노란색(주요 경영지표: 행 하이라이트용)
const HIGHLIGHT_YELLOW_ITEMS = new Set([
  "매출액",
  "매출원가계",
  "매출총이익",
  "판매비와일반관리비",
  "영업이익",
  "영업외수익",
  "영업외비용",
  "법인세차감전순이익",
  "당기순이익",
]);

// 🔹 요약 카드에 보여줄 대표 경영지표(순서 포함)
const KPI_ITEMS = [
  "매출액",
  "매출원가계",
  "매출총이익",
  "판매비와일반관리비",
  "영업이익",
  "영업외수익",
  "영업외비용",
  "법인세차감전순이익",
  "당기순이익",
];

// 🔹 요약 카드에서 '핵심 KPI'로 상단 줄에 강조해서 보여줄 항목
const KPI_PRIMARY_ITEMS = new Set([
  "매출액",
  "매출총이익",
  "영업이익",
  "당기순이익",
]);

// 🔹 각 KPI 위(=항목 바로 아래)에 보여줄 계산식/설명 텍스트
const KPI_FORMULAS = {
  매출액: "Top line · 총매출",
  매출원가계: "매출원가 + 기타매출원가",
  매출총이익: "매출총이익 = 매출액 - 매출원가계",
  판매비와일반관리비: "판매·관리 인건비, 감가상각 등",
  영업이익: "영업이익 = 매출총이익 - 판관비",
  영업외수익: "이자수익·평가이익 등",
  영업외비용: "이자비용·평가손실 등",
  법인세차감전순이익: "영업이익 + 영업외수익 - 영업외비용",
  당기순이익: "당기순이익 = 법인세차감전순이익 - 법인세비용",
};

// 🔹 초록색(국내/수출 매출 및 매출원가: 행 하이라이트용)
const HIGHLIGHT_GREEN_ITEMS = new Set([
  "국내매출액",
  "수출매출액",
  "매출원가",
  "매출원가(기타)",
]);

/* ============================
 *  코드 → 내역 매핑 테이블들
 *  (컬럼명 표시용, 데이터/키는 그대로)
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

// 판매문서 유형 (긴 목록 그대로 매핑)
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
  BK1: "대변메모요청계약",
  BK3: "대변메모요청계약",
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
  JSDD: "차변 메모 요청",
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
  RAF: "재고 문의",
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
  RXI: "XLO 내부 반품",
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

// 각 조건명 → 해당 매핑 테이블
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

function PlReportTab({ plDetailTab = "basic", setPlDetailTab }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCond, setSelectedCond] = useState("전체");

  // 🔹 연/월 선택용 상태
  const [periods, setPeriods] = useState([]); // [{year, month, label, ...}]
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // 🔹 표 / 그래프 보기 모드
  const [viewMode, setViewMode] = useState("table"); // "table" | "graph"

  // StrictMode 중복 fetch 방지
  const didInitRef = useRef(false);

  // 실제 표가 들어 있는 스크롤 컨테이너
  const mainScrollRef = useRef(null);

  // -----------------------------
  // 1) 기간 목록 조회
  // -----------------------------
  const fetchPeriods = async () => {
    try {
      const res = await fetch("/api/pl-report/periods");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = data.periods || [];

      setPeriods(list);

      if (list.length > 0) {
        const last = list[list.length - 1]; // 가장 최신 연/월
        setSelectedYear(last.year);
        setSelectedMonth(last.month);
      }
    } catch (err) {
      console.error("PL report periods fetch error:", err);
      // 기간 조회 실패 시에도 전체 로직이 멈추지 않도록, 에러 메시지만 보관
      setError("기간 목록을 불러오는 중 오류가 발생했습니다.");
    }
  };

  // -----------------------------
  // 2) 선택된 연/월에 해당하는 리포트 조회
  // -----------------------------
  const fetchData = async (year, month) => {
    if (!year || !month) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      }).toString();

      const res = await fetch(`/api/pl-report?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data.error ||
          `PL Report 조회 중 오류가 발생했습니다. (HTTP ${res.status})`;
        throw new Error(msg);
      }
      const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      console.error("PL report fetch error:", err);
      setError(err.message || "PL Report 조회에 실패했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // 최초 1회: 기간 목록 조회
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    fetchPeriods();
  }, []);

  // 연/월이 설정될 때마다 해당 월 리포트 조회
  useEffect(() => {
    if (!selectedYear || !selectedMonth) return;
    fetchData(selectedYear, selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  if (loading) return <p>불러오는 중...</p>;
  if (error && rows.length === 0) {
    return <p style={{ color: "red" }}>{error}</p>;
  }
  if (rows.length === 0) return <p>데이터가 없습니다.</p>;

  // ✅ 선택된 조건에 따라 컬럼 필터링 + "조건_전체"를 항목 바로 뒤로 이동
  const orderedColumns = (() => {
    const cols = Object.keys(rows[0]);
    const base = ["번호", "항목"];
    const others = cols.filter((c) => !base.includes(c));

    // 전체 조건일 때는 기존 로직 그대로
    if (selectedCond === "전체") {
      const totalCols = others.filter(
        (c) => c === "전체" || c.startsWith("전체_")
      );
      return [...base, ...totalCols];
    }

    const prefix = selectedCond + "_";
    const filtered = others.filter((c) => c.startsWith(prefix));

    // 🔹 이 조건의 합계 컬럼 이름 (예: 플랜트_전체)
    const totalCol = `${selectedCond}_전체`;

    const hasTotal = filtered.includes(totalCol);
    const withoutTotal = filtered.filter((c) => c !== totalCol);

    // "번호, 항목, (조건_전체), 나머지 코드들..." 순서
    const orderedForCond = hasTotal
      ? [totalCol, ...withoutTotal]
      : withoutTotal;

    return [...base, ...orderedForCond];
  })();

  // 대표 경영지표 요약에 쓸 컬럼 이름 (전체 / 조건_전체)
  const summaryColName =
    selectedCond === "전체" ? "전체" : `${selectedCond}_전체`;

  // 숫자 포맷 함수
  const formatNumber = (v) => {
    if (v === null || v === undefined || v === "") return "-";
    const num = Number(v);
    if (Number.isNaN(num)) return "-";
    return num.toLocaleString("ko-KR");
  };

  // 요약 카드용 데이터
  const kpiSummary = KPI_ITEMS.map((name) => {
    const row =
      rows.find((r) => (r["항목"] || "").trim() === name) || null;
    const raw =
      row &&
      summaryColName &&
      Object.prototype.hasOwnProperty.call(row, summaryColName)
        ? row[summaryColName]
        : null;

    return {
      name,
      value: raw,
      valueFormatted: formatNumber(raw),
    };
  });

  // 상단 핵심 KPI / 하단 기타 KPI 분리
  const primarySummary = kpiSummary.filter((item) =>
    KPI_PRIMARY_ITEMS.has(item.name)
  );
  const secondarySummary = kpiSummary.filter(
    (item) => !KPI_PRIMARY_ITEMS.has(item.name)
  );

  // 컬럼 표시 이름: 조건명_코드 → 내역(없으면 코드)
  const getDisplayColName = (col) => {
    if (col === "번호" || col === "항목" || col === "전체") return col;

    const idx = col.indexOf("_");
    if (idx === -1) return col;

    const cond = col.slice(0, idx); // 예: "플랜트"
    const code = col.slice(idx + 1); // 예: "1010"

    const map = LABEL_MAPS[cond];
    if (map && Object.prototype.hasOwnProperty.call(map, code) && map[code]) {
      return map[code]; // 내역
    }

    // 매핑 없으면 코드 그대로
    return code;
  };

  // 🔹 항목(행 제목)에 따라 배경색 리턴
  const getRowBackgroundColor = (itemName) => {
    const key = (itemName || "").trim(); // 공백 제거해서 비교

    if (HIGHLIGHT_YELLOW_ITEMS.has(key)) {
      return "#FFF9C4"; // 연한 노랑
    }
    if (HIGHLIGHT_GREEN_ITEMS.has(key)) {
      return "#E8F5E9"; // 연한 초록
    }
    return "transparent";
  };

  // 표 전체 최소 너비 (컬럼 수에 비례)
  const tableMinWidth = Math.max(orderedColumns.length * 110, 600);

  // 연/월 셀렉트용 옵션
  const yearOptions = Array.from(
    new Set(periods.map((p) => p.year))
  ).sort((a, b) => a - b);

  const monthOptions = periods
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.month - b.month);

  const handleYearChange = (e) => {
    const value = e.target.value;
    if (!value) {
      setSelectedYear(null);
      setSelectedMonth(null);
      return;
    }
    const year = Number(value);
    setSelectedYear(year);

    const monthsForYear = periods
      .filter((p) => p.year === year)
      .sort((a, b) => a.month - b.month);
    if (monthsForYear.length > 0) {
      // 같은 연도 내에서 가장 최근 월로 맞춰줌
      setSelectedMonth(monthsForYear[monthsForYear.length - 1].month);
    } else {
      setSelectedMonth(null);
    }
  };

  const handleMonthChange = (e) => {
    const value = e.target.value;
    if (!value) {
      setSelectedMonth(null);
      return;
    }
    setSelectedMonth(Number(value));
  };

  // 🔹 EXPORT → 엑셀 다운로드 함수
  const exportToExcel = () => {
    if (!rows || rows.length === 0) return;

    // 1) 헤더 + 데이터 AOA 생성
    const header = orderedColumns.map((col) => getDisplayColName(col));
    const data = rows.map((row) =>
      orderedColumns.map((col) =>
        row[col] === null || row[col] === undefined ? "" : row[col]
      )
    );

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

    // 2) 스타일 지정
    const range = XLSX.utils.decode_range(ws["!ref"]);

    // 헤더 스타일 (1행)
    for (let C = range.s.c; C <= range.e.c; C += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
      const cell = ws[cellRef] || {};
      cell.s = {
        font: { bold: true, color: { rgb: "FF111827" } },
        alignment: {
          vertical: "center",
          horizontal:
            orderedColumns[C] === "번호" || orderedColumns[C] === "항목"
              ? "left"
              : "right",
        },
        fill: { fgColor: { rgb: "FFF3F4F6" } },
        border: {
          top: { style: "thin", color: { rgb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { rgb: "FFE5E7EB" } },
          left: { style: "thin", color: { rgb: "FFE5E7EB" } },
          right: { style: "thin", color: { rgb: "FFE5E7EB" } },
        },
      };
      ws[cellRef] = cell;
    }

    // 데이터 행 스타일 (행 배경색 반영)
    for (let R = range.s.r + 1; R <= range.e.r; R += 1) {
      const dataRowIndex = R - 1; // rows 인덱스
      const itemName = rows[dataRowIndex]["항목"];
      const bg = getRowBackgroundColor(itemName);

      let fillColor = null;
      if (bg === "#FFF9C4") fillColor = "FFFFF9C4"; // 노랑
      if (bg === "#E8F5E9") fillColor = "FFE8F5E9"; // 연초록

      for (let C = range.s.c; C <= range.e.c; C += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellRef] || { t: "s", v: "" };

        const align =
          orderedColumns[C] === "번호" || orderedColumns[C] === "항목"
            ? "left"
            : "right";

        cell.s = {
          alignment: { vertical: "center", horizontal: align },
          border: {
            top: { style: "thin", color: { rgb: "FFF3F4F6" } },
            bottom: { style: "thin", color: { rgb: "FFF3F4F6" } },
            left: { style: "thin", color: { rgb: "FFF3F4F6" } },
            right: { style: "thin", color: { rgb: "FFF3F4F6" } },
          },
          ...(fillColor
            ? {
                fill: {
                  fgColor: { rgb: fillColor },
                },
              }
            : {}),
        };

        ws[cellRef] = cell;
      }
    }

    // 3) 컬럼 너비 대략 조정
    ws["!cols"] = orderedColumns.map((col) => {
      if (col === "번호") return { wch: 6 };
      if (col === "항목") return { wch: 26 };
      return { wch: 18 };
    });

    // 4) 워크북 생성 및 파일 저장
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PL Report");

    const ym =
      selectedYear && selectedMonth
        ? `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`
        : "unknown";
    const condLabel = selectedCond || "전체";
    const filename = `PL_Report_${ym}_${condLabel}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  return (
    <div
      style={{
        padding: "20px",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* 제목 + 연도/월 선택 + 조건 선택 버튼 + EXPORT */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* 왼쪽: 제목 + 연/월 드롭다운 + 표/그래프 토글 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>P&amp;L Report</h2>

          {/* 연도 선택 */}
          <select
            value={selectedYear || ""}
            onChange={handleYearChange}
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #d4d4d4",
              fontSize: 12,
            }}
          >
            <option value="">연도 선택</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>

          {/* 월 선택 */}
          <select
            value={selectedMonth || ""}
            onChange={handleMonthChange}
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #d4d4d4",
              fontSize: 12,
            }}
            disabled={!selectedYear || monthOptions.length === 0}
          >
            <option value="">월 선택</option>
            {monthOptions.map((p) => (
              <option key={p.month} value={p.month}>
                {String(p.month).padStart(2, "0")}월
              </option>
            ))}
          </select>

          {/* 🔹 표 / 그래프 토글 버튼 */}
          <div
            style={{
              marginLeft: 4,
              display: "inline-flex",
              borderRadius: 999,
              border: "1px solid #d4d4d4",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("table")}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                border: "none",
                cursor: "pointer",
                backgroundColor:
                  viewMode === "table" ? "#111827" : "#ffffff",
                color: viewMode === "table" ? "#ffffff" : "#4b5563",
                fontWeight: viewMode === "table" ? 600 : 500,
              }}
            >
              표 보기
            </button>
            <button
              type="button"
              onClick={() => setViewMode("graph")}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                borderLeft: "1px solid #d4d4d4",
                cursor: "pointer",
                backgroundColor:
                  viewMode === "graph" ? "#111827" : "#ffffff",
                color: viewMode === "graph" ? "#ffffff" : "#4b5563",
                fontWeight: viewMode === "graph" ? 600 : 500,
              }}
            >
              그래프 보기
            </button>
          </div>
        </div>

        {/* 오른쪽: EXPORT 버튼 + 조건 버튼들 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={exportToExcel}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid #2563eb",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(37,99,235,0.4)",
            }}
          >
            EXPORT
          </button>

          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {CONDITION_KEYS.map((cond) => (
              <button
                key={cond}
                type="button"
                onClick={() => setSelectedCond(cond)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "16px",
                  border:
                    selectedCond === cond
                      ? "1px solid #2563eb"
                      : "1px solid #d4d4d4",
                  backgroundColor:
                    selectedCond === cond ? "#2563eb" : "#ffffff",
                  color: selectedCond === cond ? "#ffffff" : "#111827",
                  fontSize: "12px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cond}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ▼▼ viewMode 에 따라 분기 ▼▼ */}
      {viewMode === "table" && (
        <>
          {/* 대표 경영지표 요약 카드 영역 */}
          <div
            style={{
              background: "#f9fafb",
              borderRadius: 18,
              border: "1px solid #e5e7eb",
              boxShadow: "0 16px 32px rgba(15,23,42,0.06)",
              padding: "14px 16px",
              boxSizing: "border-box",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#9ca3af",
                marginBottom: 2,
                paddingLeft: 2,
              }}
            >
              대표 경영지표 요약 (선택된 조건:&nbsp;
              <span style={{ fontWeight: 600, color: "#4b5563" }}>
                {selectedCond === "전체" ? "전체" : `${selectedCond} - 전체`}
              </span>
              )
              {selectedYear && selectedMonth && (
                <>
                  &nbsp;| 조회 기간:&nbsp;
                  <span style={{ fontWeight: 600, color: "#4b5563" }}>
                    {selectedYear}년 {String(selectedMonth).padStart(2, "0")}월
                  </span>
                </>
              )}
            </div>

            {/* 1줄차: 핵심 KPI */}
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "nowrap",
              }}
            >
              {primarySummary.map((item) => {
                const formula = KPI_FORMULAS[item.name] || "";

                return (
                  <div
                    key={item.name}
                    style={{
                      flex: "1 1 0",
                      minWidth: 0,
                      padding: "10px 14px",
                      borderRadius: 16,
                      backgroundColor: "#FFFBEB",
                      border: "1px solid #FACC15",
                      boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#374151",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: "#111827",
                          textAlign: "right",
                          maxWidth: "60%",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={item.valueFormatted}
                      >
                        {item.valueFormatted}
                      </div>
                    </div>

                    {formula && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={formula}
                      >
                        {formula}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 2줄차: 나머지 KPI */}
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "nowrap",
              }}
            >
              {secondarySummary.map((item) => {
                const formula = KPI_FORMULAS[item.name] || "";

                return (
                  <div
                    key={item.name}
                    style={{
                      flex: "1 1 0",
                      minWidth: 0,
                      padding: "8px 12px",
                      borderRadius: 14,
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#4b5563",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#111827",
                          textAlign: "right",
                          maxWidth: "60%",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={item.valueFormatted}
                      >
                        {item.valueFormatted}
                      </div>
                    </div>

                    {formula && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#9ca3af",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={formula}
                      >
                        {formula}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ====== 테이블 카드 ====== */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
              padding: "12px 12px 10px",
              boxSizing: "border-box",
              width: "100%",
              maxWidth: "100%",
              overflow: "hidden",
            }}
          >
            {/* ▼▼ 표 전용 스크롤 영역 (세로+가로) ▼▼ */}
            <div
              ref={mainScrollRef}
              style={{
                width: "100%",
                maxWidth: "100%",
                maxHeight: "68vh", // 세로 스크롤
                overflowX: "auto", // 이 영역 안에서만 가로 스크롤
                overflowY: "auto",
              }}
            >
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: "13px",
                  tableLayout: "auto",
                  whiteSpace: "nowrap",
                  minWidth: tableMinWidth,
                }}
              >
                <thead>
                  <tr>
                    {orderedColumns.map((col) => (
                      <th
                        key={col}
                        style={{
                          borderBottom: "2px solid #e5e7eb",
                          padding: "8px 10px",
                          position: "sticky",
                          top: 0,
                          background: "#f9fafb",
                          textAlign:
                            col === "번호" || col === "항목"
                              ? "left"
                              : "right",
                          zIndex: 2,
                        }}
                      >
                        {getDisplayColName(col)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, idx) => {
                    const itemName = row["항목"];
                    const rowBg = getRowBackgroundColor(itemName);

                    return (
                      <tr key={idx} style={{ backgroundColor: rowBg }}>
                        {orderedColumns.map((col) => (
                          <td
                            key={col}
                            style={{
                              borderBottom: "1px solid #f3f4f6",
                              padding: "6px 10px",
                              textAlign:
                                col === "번호" || col === "항목"
                                  ? "left"
                                  : "right",
                            }}
                          >
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* ▲▲ 표 전용 스크롤 영역 끝 ▲▲ */}
          </div>
        </>
      )}

      {viewMode === "graph" && (
        <PlReportGraphTab
          rows={rows}
          selectedCond={selectedCond}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      )}
    </div>
  );
}

export default PlReportTab;
