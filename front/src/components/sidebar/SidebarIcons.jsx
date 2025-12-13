// src/components/sidebar/SidebarIcons.jsx
import React from "react";

export default function SidebarIcons({
  sideMenus,
  tab,
  setTab,
  logoSmall,

  SIDEBAR_ICON_WIDTH,

  // file input refs
  costFileInputRef,
  plFileInputRef,

  // status style
  costIconStyle,
  plIconStyle,

  // logout
  onLogout,
}) {
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
      {/* 상단 로고 아이콘 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
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
            style={{
              maxWidth: "70%",
              maxHeight: "70%",
              objectFit: "contain",
            }}
          />
        </div>
      </div>

      {/* 탭 아이콘들 */}
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
                  minWidth: ICON_BOX,
                  minHeight: ICON_BOX,
                  borderRadius: 10,
                  backgroundColor: active ? "#e2e8f0" : "#f8fafc",
                  border: "1px solid " + (active ? "#cbd5e1" : "#e5e7eb"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
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

      {/* 하단 업로드 아이콘들 */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => costFileInputRef.current?.click()}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
          }}
          title="코스트센터별 비용 업로드 (Dashboard/Closing/Variance)"
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 12,
              backgroundColor: "#ffffff",
              border: `1px solid ${costIconStyle.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: costIconStyle.color,
            }}
          >
            C
          </div>
        </button>

        <button
          type="button"
          onClick={() => plFileInputRef.current?.click()}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
          }}
          title="결산보고서 Back data 업로드 (P&L)"
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 12,
              backgroundColor: "#ffffff",
              border: `1px solid ${plIconStyle.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: plIconStyle.color,
            }}
          >
            P
          </div>
        </button>

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
