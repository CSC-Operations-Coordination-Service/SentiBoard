"use client";
import { useState } from "react";

const NEWS_ITEMS = [
  { date: "23 Jun 2026", time: "11:22", title: "Nominal operations ensured by Sentinel-1A and Sentinel-1D.", status: "nominal" },
  { date: "12 Jul 2026", time: "11:22", title: "Ground Segment planned maintenance from 17/06/2026 to 18/07/2026; NRTI production may be interrupted.", status: "warning" },
  { date: "28 Jul 2026", time: "06:48", title: "Sentinel-3 thermal sensor degraded.", status: "degraded" },
];

export default function ExpandableNewsBar() {
  const [expanded, setExpanded] = useState(false);
  const activeNews = NEWS_ITEMS[0];

  return (
    <div style={{
      background: "linear-gradient(90deg, #0B0D10 0%, #14181D 100%)",
      borderBottom: "1px solid rgba(255,255,255,.14)",
      transition: "max-height 0.3s ease",
      overflow: "hidden",
      maxHeight: expanded ? "300px" : "48px",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "12px 28px",
          border: "none",
          background: "none",
          color: "inherit",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          cursor: "pointer",
          fontSize: "13px",
        }}
      >
        <span style={{
          fontFamily: "var(--mono)",
          fontSize: "10px",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "#3DD68C",
          display: "flex",
          alignItems: "center",
          gap: "7px",
        }}>
          <i style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#3DD68C",
            display: "inline-block",
            animation: "pulse 2.4s infinite",
          }} />
          News
        </span>
        <span style={{ flex: 1, textAlign: "left", color: "#F2F4F5" }}>
          {activeNews.date} · {activeNews.title}
        </span>
        <span style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}>▼</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 28px 16px", borderTop: "1px solid rgba(255,255,255,.08)" }}>
          {NEWS_ITEMS.map((item, idx) => (
            <div key={idx} style={{
              padding: "12px 0",
              borderBottom: idx < NEWS_ITEMS.length - 1 ? "1px solid rgba(255,255,255,.08)" : "none",
              fontSize: "13px",
            }}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "4px" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "#8A9198", minWidth: "80px" }}>
                  {item.date}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "#8A9198" }}>
                  {item.time}
                </span>
              </div>
              <p style={{ margin: "0", color: "#F2F4F5" }}>{item.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
