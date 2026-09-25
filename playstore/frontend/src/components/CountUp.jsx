import { useEffect, useRef, useState } from "react";

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Ticks from 0 to `value` over `duration`ms with an easeOutCubic curve,
// formatted en-IN (so large numbers pick up lakh/crore-style grouping).
// Runs once when the value first becomes available (and again if it
// changes), not on every render.
export function CountUp({ value, duration = 1000, format = true }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const startedAt = performance.now();

    function tick(now) {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / duration);
      setDisplay(Math.round(target * easeOutCubic(progress)));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    }

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return <>{format ? display.toLocaleString("en-IN") : display}</>;
}
