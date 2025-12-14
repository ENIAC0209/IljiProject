// src/components/sidebar/SidebarIcons.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
} from "react";
import uploadIcon from "../../assets/icons/upload.png";
import uploadClearIcon from "../../assets/icons/upload_clear.png";

export default function SidebarIcons({
  sideMenus,
  tab,
  setTab,
  logoSmall,
  SIDEBAR_ICON_WIDTH,

  costFileInputRef,
  plFileInputRef,

  costIconStyle,
  plIconStyle,
  costIconStatus, // "idle" | "pending" | "uploading" | "uploaded"
  plIconStatus,

  pendingCostFile,
  pendingPlFile,

  costUploading,
  plUploading,

  onPickCostFile,
  onPickPlFile,
  onConfirmCost,
  onCancelCost,
  onConfirmPl,
  onCancelPl,

  onLogout,
}) {
  const [openUploadMenu, setOpenUploadMenu] = useState(false);
  const menuRef = useRef(null);
  const popupRef = useRef(null);

  const [popupPos, setPopupPos] = useState({ left: 0, top: 0, width: 190 });

  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setOpenUploadMenu(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const isAnyUploading = !!costUploading || !!plUploading;

  const isAllUploaded = useMemo(() => {
    return costIconStatus === "uploaded" && plIconStatus === "uploaded";
  }, [costIconStatus, plIconStatus]);

  const uploadBtnIcon = isAllUploaded ? uploadClearIcon : uploadIcon;

  const borderColor =
    costIconStyle?.border !== "#9CA3AF"
      ? costIconStyle.border
      : plIconStyle?.border !== "#9CA3AF"
      ? plIconStyle.border
      : "#e5e7eb";

  const statusToBarColor = (status) => {
    if (status === "uploaded") return "#22c55e";
    if (status === "uploading") return "#f59e0b";
    if (status === "pending") return "#3b82f6";
    return "#9ca3af";
  };

  const costBarColor = statusToBarColor(costIconStatus);
  const plBarColor = statusToBarColor(plIconStatus);

  const costBlink = costIconStatus === "uploading";
  const plBlink = plIconStatus === "uploading";

  const pickCost = () =>
    onPickCostFile ? onPickCostFile() : costFileInputRef.current?.click();
  const pickPl = () =>
    onPickPlFile ? onPickPlFile() : plFileInputRef.current?.click();

  // ✅ 팝업 열릴 때 viewport 밖으로 안 나가게 clamp
  useLayoutEffect(() => {
    if (!openUploadMenu) return;

    const PADDING = 10;
    const POP_W = 190;
    const POP_H_EST = 210;

    const anchor = menuRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();

    let left = rect.left + rect.width + 10;
    let top = rect.bottom - POP_H_EST;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (left + POP_W > vw - PADDING) left = vw - POP_W - PADDING;
    if (left < PADDING) left = PADDING;

    if (top + POP_H_EST > vh - PADDING) top = vh - POP_H_EST - PADDING;
    if (top < PADDING) top = PADDING;

    setPopupPos({ left, top, width: POP_W });
  }, [openUploadMenu]);

  const shortName = (name, maxLen = 16) => {
    const s = String(name || "");
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "…";
  };

  // ✅ “파일만” 보여주는 한 줄 박스 (pending/업로드완료 공용)
  const FileOnlyRow = ({ file, onCancel, dotColor = "#3b82f6" }) => {
    if (!file) return null;
    return (
      <div
        style={{
          width: "100%",
          padding: "10px 10px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: dotColor,
            flex: "0 0 auto",
          }}
        />
        <div
          title={file.name}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 10,
            fontWeight: 900,
            color: "#0f172a",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {shortName(file.name, 16)}
        </div>

        <button
          type="button"
          onClick={onCancel}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            color: "#64748b",
            padding: "0 4px",
            flex: "0 0 auto",
          }}
          aria-label="cancel"
          title="취소"
        >
          ×
        </button>
      </div>
    );
  };

  const ActionButton = ({ label, onClick, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        marginTop: 8,
        padding: "8px 10px",
        borderRadius: 10,
        border: disabled
          ? "1px solid #e5e7eb"
          : "1px solid rgba(22,163,74,0.35)",
        background: disabled ? "#f1f5f9" : "rgba(22,163,74,0.10)",
        cursor: disabled ? "default" : "pointer",
        fontSize: 10,
        fontWeight: 900,
        color: disabled ? "#94a3b8" : "#166534",
        boxSizing: "border-box",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </button>
  );

  // ✅ 파일이 선택되면 “Cost 데이터 버튼/글자”는 보여주지 않음
  // - pendingCostFile 있으면: 파일표시 + 분석버튼
  // - 없으면: 기존 선택 버튼만
  const CostBlock = () => {
    const hasFile = !!pendingCostFile;

    return (
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: "#0f172a",
            marginBottom: 6,
          }}
        >
          Cost
        </div>

        {!hasFile ? (
          <button
            type="button"
            onClick={pickCost}
            style={{
              width: "100%",
              border: "1px solid #e5e7eb",
              background: "#f8fafc",
              borderRadius: 12,
              padding: "10px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: "#0f172a",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Cost 데이터 선택
            </span>
            <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>
              +
            </span>
          </button>
        ) : (
          <>
            {/* ✅ 파일이 선택된 순간부터는 버튼/글자 숨기고 파일만 “위에” 표시 */}
            <FileOnlyRow
              file={pendingCostFile}
              onCancel={onCancelCost}
              dotColor={costIconStatus === "uploaded" ? "#22c55e" : "#3b82f6"}
            />
            <ActionButton
              label={costUploading ? "적용 중..." : "적용"}
              onClick={onConfirmCost}
              disabled={costUploading}
            />
          </>
        )}
      </div>
    );
  };

  const PlBlock = () => {
    const hasFile = !!pendingPlFile;

    return (
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: "#0f172a",
            marginBottom: 6,
          }}
        >
          P&amp;L
        </div>

        {!hasFile ? (
          <button
            type="button"
            onClick={pickPl}
            style={{
              width: "100%",
              border: "1px solid #e5e7eb",
              background: "#f8fafc",
              borderRadius: 12,
              padding: "10px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: "#0f172a",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              P&amp;L 파일 선택
            </span>
            <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>
              +
            </span>
          </button>
        ) : (
          <>
            <FileOnlyRow
              file={pendingPlFile}
              onCancel={onCancelPl}
              dotColor={plIconStatus === "uploaded" ? "#22c55e" : "#3b82f6"}
            />
            <ActionButton
              label={plUploading ? "적용 중..." : "적용"}
              onClick={onConfirmPl}
              disabled={plUploading}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: SIDEBAR_ICON_WIDTH,
        backgroundColor: "#ffffff",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        padding: "18px 8px",
        boxSizing: "border-box",
        zIndex: 30,
      }}
    >
      <style>{`
        @keyframes blinkSoft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      {/* 상단 로고 */}
      <div
        style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: "#f8fafc",
            border: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={logoSmall}
            alt="ILJI TECH"
            style={{ maxWidth: "70%", maxHeight: "70%", objectFit: "contain" }}
          />
        </div>
      </div>

      {/* 탭 아이콘 */}
      <nav
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}
      >
        {sideMenus.map((m) => {
          const active = tab === m.id;
          const ICON_BOX = 36;
          const ICON_SIZE = 20;

          return (
            <button
              key={m.id}
              onClick={() => setTab(m.id)}
              title={m.label}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "4px 0",
              }}
            >
              <div
                style={{
                  width: ICON_BOX,
                  height: ICON_BOX,
                  borderRadius: 10,
                  backgroundColor: active ? "#e2e8f0" : "#f8fafc",
                  border: "1px solid " + (active ? "#cbd5e1" : "#e5e7eb"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={m.icon}
                  alt={m.label}
                  style={{
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    objectFit: "contain",
                    opacity: active ? 1 : 0.75,
                    display: "block",
                  }}
                />
              </div>
            </button>
          );
        })}
      </nav>

      {/* 하단: 업로드 + 로그아웃 */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* 업로드 버튼 (anchor) */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setOpenUploadMenu((v) => !v)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
            }}
            title="데이터 업로드"
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 12,
                backgroundColor: "#ffffff",
                border: `1px solid ${borderColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <img
                src={uploadBtnIcon}
                alt="upload"
                style={{
                  width: 18,
                  height: 18,
                  position: "relative",
                  zIndex: 1,
                }}
              />

              {/* 상태바 */}
              <div
                style={{
                  position: "absolute",
                  left: 4,
                  right: 4,
                  bottom: 4,
                  height: 5,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "#e5e7eb",
                  zIndex: 3,
                  display: "flex",
                }}
              >
                <div
                  title={`Cost: ${costIconStatus}`}
                  style={{
                    flex: 1,
                    background: costBarColor,
                    animation: costBlink
                      ? "blinkSoft 1.1s ease-in-out infinite"
                      : "none",
                  }}
                />
                <div
                  style={{ width: 1, background: "rgba(255,255,255,0.7)" }}
                />
                <div
                  title={`P&L: ${plIconStatus}`}
                  style={{
                    flex: 1,
                    background: plBarColor,
                    animation: plBlink
                      ? "blinkSoft 1.1s ease-in-out infinite"
                      : "none",
                  }}
                />
              </div>

              {isAnyUploading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(245, 158, 11, 0.18)",
                    zIndex: 2,
                  }}
                />
              )}
            </div>
          </button>
        </div>

        {/* 팝업 */}
        {openUploadMenu && (
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              left: popupPos.left,
              top: popupPos.top,
              width: popupPos.width,
              maxWidth: "calc(100vw - 20px)",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              boxShadow: "0 18px 40px rgba(15,23,42,0.12)",
              padding: 10,
              zIndex: 60,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, color: "#0f172a" }}>
              업로드
            </div>

            <CostBlock />
            <PlBlock />
          </div>
        )}

        {/* 로그아웃 */}
        <button
          type="button"
          onClick={onLogout}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
          }}
          title="로그아웃"
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 12,
              backgroundColor: "#ffffff",
              border: "1px solid #fecaca",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 900,
              color: "#dc2626",
            }}
          >
            ⎋
          </div>
        </button>
      </div>
    </aside>
  );
}
