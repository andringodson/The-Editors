import { ImageResponse } from "next/og";

/**
 * Social card, generated at request time rather than shipped as a PNG so it
 * never drifts out of sync with the design.
 *
 * Rendered by Satori, which supports only a subset of CSS — flexbox but no
 * grid, and every element needs an explicit `display`. Keeping the composition
 * to nested flex boxes with solid fills is what makes it reliable; clever CSS
 * silently renders as a blank card.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "The Editors — image and document tools that run entirely in your browser";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 30% 20%, #4c1d95 0%, #1a0b3d 45%, #000000 100%)",
        padding: 60,
      }}
    >
      {/* The window */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#c0c0c0",
          border: "3px solid #000000",
          padding: 4,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, #3b1d8f, #8b5cf6)",
            color: "#ffffff",
            padding: "12px 16px",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex" }}>The Editors</div>
          {/*
              Empty bordered boxes rather than the usual _ □ ✕ glyphs: Satori
              fetches a font per glyph, and the box-drawing and multiplication
              characters 400 on that lookup, which renders them blank. Plain
              boxes read as window controls and cannot fail.
            */}
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  width: 34,
                  height: 28,
                  background: "#c0c0c0",
                  border: "2px solid #000000",
                  borderTopColor: "#ffffff",
                  borderLeftColor: "#ffffff",
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            padding: "0 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 70,
              fontWeight: 800,
              color: "#000000",
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            Tools that never
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 70,
              fontWeight: 800,
              color: "#3b1d8f",
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            upload your files
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 28,
              color: "#333333",
            }}
          >
            Compress to an exact size · Passport photos · Merge PDFs
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 34 }}>
            {["Free", "No upload", "Works offline"].map((chip) => (
              <div
                key={chip}
                style={{
                  display: "flex",
                  background: "#c0c0c0",
                  border: "2px solid #000000",
                  borderTopColor: "#ffffff",
                  borderLeftColor: "#ffffff",
                  padding: "10px 20px",
                  fontSize: 24,
                  color: "#000000",
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
