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
          marginTop: 13,
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
    </div>
  );
}
