// src/components/sidebar/SidebarPanel.jsx
import React from "react";

export default function SidebarPanel({
  sideMenus,
  tab,
  setTab,

  SIDEBAR_ICON_WIDTH,
  SIDEBAR_PANEL_WIDTH,

  BRAND_DARK,

  // refs
  costFileInputRef,
  plFileInputRef,

  // status labels
  costStatusLabel,
  plStatusLabel,
  costIconStatus,
  plIconStatus,

  // pending files
  pendingCostFile,
  pendingPlFile,

  // handlers
  handleConfirmCostUpload,
  handleCancelPendingCostFile,
  costUploading,

  handleConfirmPlUpload,
  handleCancelPendingPlFile,
  plUploading,
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        bottom: 0,
        left: SIDEBAR_ICON_WIDTH,
        width: SIDEBAR_PANEL_WIDTH - SIDEBAR_ICON_WIDTH,
        backgroundColor: "#ffffff",
        borderRight: "1px solid #e5e7eb",
        boxSizing: "border-box",
        padding: "16px 14px",
        display: "flex",
        flexDirection: "column",
        opacity: 1,
        transform: "translateX(0)",
        pointerEvents: "auto",
        transition: "none",
        zIndex: 25,
        fontSize: 11,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 34,
          marginBottom: 14,
          paddingLeft: 2,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: 1,
              color: BRAND_DARK,
            }}
          >
            ILJI TECH
          </span>
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>
            AI Closing Monitor
          </span>
        </div>
      </div>

      <nav
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginBottom: 12,
        }}
      >
        {sideMenus.map((m) => {
          const active = tab === m.id;

          return (
            <button
              key={m.id}
              onClick={() => setTab(m.id)}
              style={{
                border: "1px solid " + (active ? "#cbd5e1" : "transparent"),
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 12,
                cursor: "pointer",
                backgroundColor: active ? "#f1f5f9" : "transparent",
                color: active ? BRAND_DARK : "#64748b",
                transition:
                  "background-color 0.15s ease, border-color 0.15s ease",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {active && (
                <span
                  style={{
                    position: "absolute",
                    left: 6,
                    top: 10,
                    bottom: 10,
                    width: 3,
                    borderRadius: 999,
                    backgroundColor: "#1e40af",
                  }}
                />
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  paddingLeft: active ? 10 : 0,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: active ? 800 : 600 }}>
                  {m.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: active ? "#475569" : "#94a3b8",
                    fontWeight: 600,
                  }}
                >
                  {m.desc}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* 업로드 영역 */}
      <div
        style={{
          marginTop: 4,
          padding: 10,
          borderRadius: 12,
          backgroundColor: "#f8fafc",
          border: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 10, color: "#334155" }}>
          업로드
        </div>

        {/* Cost */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              padding: "6px 8px",
              borderRadius: 10,
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
            }}
            onClick={() => costFileInputRef.current?.click()}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
              Cost 데이터
            </span>

            {costStatusLabel && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color:
                    costIconStatus === "uploaded"
                      ? "#16a34a"
                      : costIconStatus === "uploading"
                      ? "#f97316"
                      : costIconStatus === "pending"
                      ? "#2563eb"
                      : "#94a3b8",
                }}
              >
                {costStatusLabel}
              </span>
            )}
          </div>

          {pendingCostFile && (
            <div
              style={{
                padding: 8,
                borderRadius: 12,
                backgroundColor: "#ffffff",
                border: "1px dashed #cbd5e1",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  color: "#334155",
                  fontWeight: 700,
                }}
                title={pendingCostFile.name}
              >
                {pendingCostFile.name}
              </div>

              <button
                type="button"
                onClick={handleConfirmCostUpload}
                disabled={costUploading}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: costUploading
                    ? "1px solid #e5e7eb"
                    : "1px solid #16a34a",
                  backgroundColor: "transparent",
                  cursor: costUploading ? "default" : "pointer",
                  fontSize: 9,
                  fontWeight: 900,
                  color: costUploading ? "#94a3b8" : "#16a34a",
                }}
              >
                {costUploading ? "분석 중..." : "분석"}
              </button>

              <button
                type="button"
                onClick={handleCancelPendingCostFile}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  color: "#64748b",
                  padding: "0 4px",
                }}
                aria-label="cancel"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* P&L */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              padding: "6px 8px",
              borderRadius: 10,
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
            }}
            onClick={() => plFileInputRef.current?.click()}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
              P&amp;L Back 데이터
            </span>

            {plStatusLabel && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color:
                    plIconStatus === "uploaded"
                      ? "#16a34a"
                      : plIconStatus === "uploading"
                      ? "#f97316"
                      : plIconStatus === "pending"
                      ? "#2563eb"
                      : "#94a3b8",
                }}
              >
                {plStatusLabel}
              </span>
            )}
          </div>

          {pendingPlFile && (
            <div
              style={{
                padding: 8,
                borderRadius: 12,
                backgroundColor: "#ffffff",
                border: "1px dashed #cbd5e1",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  color: "#334155",
                  fontWeight: 700,
                }}
                title={pendingPlFile.name}
              >
                {pendingPlFile.name}
              </div>

              <button
                type="button"
                onClick={handleConfirmPlUpload}
                disabled={plUploading}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: plUploading
                    ? "1px solid #e5e7eb"
                    : "1px solid #16a34a",
                  backgroundColor: "transparent",
                  cursor: plUploading ? "default" : "pointer",
                  fontSize: 9,
                  fontWeight: 900,
                  color: plUploading ? "#94a3b8" : "#16a34a",
                }}
              >
                {plUploading ? "적용 중..." : "적용"}
              </button>

              <button
                type="button"
                onClick={handleCancelPendingPlFile}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  color: "#64748b",
                  padding: "0 4px",
                }}
                aria-label="cancel"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
