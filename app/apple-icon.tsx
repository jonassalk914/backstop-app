import { ImageResponse } from "next/og";

// 180x180 apple-touch-icon. iOS doesn't apply a mask so we can let the
// diamond fill more of the canvas than the maskable Android variant.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
            width: "60%",
            height: "60%",
            background: "#d4ff00",
            transform: "rotate(45deg)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
