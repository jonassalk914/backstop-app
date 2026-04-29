import { ImageResponse } from "next/og";

// 512x512 PWA icon. Smaller diamond + extra padding so the icon survives
// Android's maskable mask (uses ~80% of the canvas as the safe zone).
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function IconLarge() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "45%",
            height: "45%",
            background: "#d4ff00",
            transform: "rotate(45deg)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
