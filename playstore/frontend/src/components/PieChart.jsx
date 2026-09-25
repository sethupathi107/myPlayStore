import { useState } from "react";

// A plain SVG donut chart - no charting library, just circle/arc math.
// Slices are drawn as separate wedge paths (with a small gap between them),
// and the donut hole shows the running total. Hovering a slice pops it out
// slightly (CSS transform from the chart's center) and shows a detail card
// (name/count/percentage) anchored top-center - not a leader line out to
// the slice's own position, since that line and the card would drift
// apart on any screen where the card can't sit right next to the slice
// (which is every screen once the card position is fixed for safety - see
// the tooltip's own comment below).

const COLORS = [
  "#024950", // cobalt
  "#0fa4af", // cobalt-tint
  "#964734", // magenta
  "#ab6c5d", // pink-hot
  "#93d6db", // mint
  "#4b3c35", // plum
  "#a0837b", // yellow
  "#dabfb8", // pink
  "#95c7cf", // cream-deep
  "#003135", // olive
];

const SIZE = 420;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 180;
const INNER_RADIUS = 108;
const GAP_DEGREES = 1.2; // small visual gap between slices

function polarToCartesian(angleDegrees, radius) {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(angleRadians),
    y: CENTER + radius * Math.sin(angleRadians),
  };
}

function describeSlice(startAngle, endAngle) {
  const outerStart = polarToCartesian(startAngle, OUTER_RADIUS);
  const outerEnd = polarToCartesian(endAngle, OUTER_RADIUS);
  const innerStart = polarToCartesian(endAngle, INNER_RADIUS);
  const innerEnd = polarToCartesian(startAngle, INNER_RADIUS);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function formatNumber(value) {
  return value.toLocaleString("en-IN");
}

export function PieChart({ data, valueKey = "count", labelKey = "name", centerLabel = "Total" }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) return <p className="status-text">No data yet.</p>;

  const total = data.reduce((sum, row) => sum + row[valueKey], 0);
  let angle = 0;

  const slices = data.map((row, index) => {
    const fraction = total > 0 ? row[valueKey] / total : 0;
    const sweep = fraction * 360;
    const startAngle = angle + GAP_DEGREES / 2;
    const endAngle = angle + sweep - GAP_DEGREES / 2;
    angle += sweep;

    return {
      row,
      index,
      color: COLORS[index % COLORS.length],
      path: endAngle > startAngle ? describeSlice(startAngle, endAngle) : null,
      percentage: row.percentage,
    };
  });

  const hovered = hoveredIndex !== null ? slices[hoveredIndex] : null;

  return (
    <div className="pie-chart">
      <div className="pie-chart-canvas" style={{ maxWidth: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {slices.map(
            (slice) =>
              slice.path && (
                <path
                  key={slice.row.categoryId ?? slice.row[labelKey]}
                  d={slice.path}
                  fill={slice.color}
                  className={`pie-chart-slice${hoveredIndex === slice.index ? " is-hovered" : ""}`}
                  style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                  onMouseEnter={() => setHoveredIndex(slice.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              )
          )}

          <text x={CENTER} y={CENTER - 8} textAnchor="middle" className="pie-chart-center-value">
            {formatNumber(total)}
          </text>
          <text x={CENTER} y={CENTER + 24} textAnchor="middle" className="pie-chart-center-label">
            {centerLabel}
          </text>
        </svg>

        {hovered && (
          // Always anchored top-center (in % of the canvas's own box, so it
          // scales with it on any screen size) instead of floating out to
          // whichever side the slice sits on - that old left/right-of-the-
          // leader-line positioning could push the tooltip past the edge
          // of the canvas (and off the visible page entirely on a narrow
          // viewport) for slices near the left or right edge of the donut.
          <div className="pie-chart-tooltip">
            <span className="pie-chart-tooltip-swatch" style={{ background: hovered.color }} />
            <div>
              <div className="pie-chart-tooltip-name">{hovered.row[labelKey]}</div>
              <div className="pie-chart-tooltip-value">
                {formatNumber(hovered.row[valueKey])} · {hovered.percentage}%
              </div>
            </div>
          </div>
        )}
      </div>

      <ul className="pie-chart-legend">
        {slices.map((slice) => (
          <li
            key={slice.row.categoryId ?? slice.row[labelKey]}
            className={hoveredIndex === slice.index ? "is-hovered" : ""}
            onMouseEnter={() => setHoveredIndex(slice.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span className="pie-chart-swatch" style={{ background: slice.color }} />
            <span className="pie-chart-legend-name">{slice.row[labelKey]}</span>
            <span className="muted">
              {formatNumber(slice.row[valueKey])} ({slice.percentage}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
