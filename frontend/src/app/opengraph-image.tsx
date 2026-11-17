import { ImageResponse } from "next/og";

export const alt = "Øv til eksamen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0f2f31";
const TEAL = "#1d5c5e";
const MARK = "rgba(252, 211, 77, 0.75)";

/** A sheet of text lines with a few marked, like a chapter you are reading */
function Page({ rotate, marked, top, left }: { rotate: number; marked: number[]; top: number; left: number }) {
  const widths = [88, 96, 72, 94, 80, 90, 60, 92, 76, 84];
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: 340,
        height: 440,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "40px 36px",
        background: "#ffffff",
        borderRadius: 18,
        border: "2px solid #d5e5e4",
        boxShadow: "0 24px 60px rgba(15, 47, 49, 0.14)",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div style={{ width: "62%", height: 18, borderRadius: 6, background: TEAL, marginBottom: 10 }} />
      {widths.map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w}%`,
            height: 12,
            borderRadius: 6,
            background: marked.includes(i) ? MARK : "#dfe9e8",
          }}
        />
      ))}
    </div>
  );
}

/** The preview shown when a link to the site is shared */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #f6fafa 0%, #e6f1f0 100%)",
          color: INK,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 28,
            width: 640,
            paddingLeft: 80,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", fontSize: 104, lineHeight: 1.02, letterSpacing: -2 }}>
            <span>Øv til</span>
            {/* The marker behind the word echoes how you mark text in the app */}
            <span style={{ display: "flex" }}>
              <span style={{ background: MARK, padding: "0 14px", margin: "0 -14px", borderRadius: 10 }}>eksamen</span>
            </span>
          </div>
          <div style={{ fontSize: 32, color: "#3b5a5c", lineHeight: 1.35, maxWidth: 520 }}>
            Les, marker, skriv notater og øv med quiz og flashcards.
          </div>
          <div style={{ display: "flex", fontSize: 26, color: TEAL, marginTop: 8 }}>Lær for eksamen</div>
        </div>

        <Page rotate={-6} marked={[]} top={110} left={700} />
        <Page rotate={4} marked={[1, 2, 6]} top={95} left={790} />
      </div>
    ),
    size,
  );
}
