import { Star } from "lucide-react";

// Read-only stars (fractional fill via a clipped overlay) or an interactive
// 1-5 picker when onChange is given (used by the "write a review" form).
export function StarRating({ value, size = 16, onChange }) {
  const stars = [1, 2, 3, 4, 5];
  const interactive = typeof onChange === "function";

  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {stars.map((n) => {
        const filled = value >= n;
        const partial = !filled && value > n - 1 ? value - (n - 1) : null;
        return (
          <span
            key={n}
            style={{ position: "relative", display: "inline-flex", cursor: interactive ? "pointer" : "default" }}
            onClick={interactive ? () => onChange(n) : undefined}
          >
            <Star size={size} color="var(--border-strong)" fill="var(--border-strong)" />
            {(filled || partial) && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  width: filled ? "100%" : `${partial * 100}%`,
                }}
              >
                <Star size={size} color="var(--yellow)" fill="var(--yellow)" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
