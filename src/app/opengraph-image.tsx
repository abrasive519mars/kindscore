import { ImageResponse } from "next/og";
import { BRAND } from "@/config/constants";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Ivory card, the wordmark with its saffron full stop, the tagline, the five numerals. No photo, no golf. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#F7F3EC",
        color: "#171411",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 56 }}>
        {BRAND.name}
        <span style={{ color: "#D9791A" }}>.</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 76, lineHeight: 1.05, maxWidth: 1000 }}>
          Your last five rounds could fund a classroom.
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#5E574F" }}>{BRAND.tagline}</div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 40,
          fontSize: 64,
          borderTop: "2px solid #DED8CF",
          paddingTop: 24,
        }}
      >
        {[28, 33, 31, 36, 29].map((n, i) => (
          <span key={n} style={{ color: [1, 3, 4].includes(i) ? "#D9791A" : "#171411" }}>
            {n}
          </span>
        ))}
      </div>
    </div>,
    size,
  );
}
