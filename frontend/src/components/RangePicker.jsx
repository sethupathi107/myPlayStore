import { useEffect, useRef, useState } from "react";
import { Dropdown } from "./Dropdown";

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

// A "Last 7 days / Last 30 days / Custom range" picker. The start/end date
// inputs only show up in custom mode - presets (7d/30d) are just the
// dropdown on its own.
export function RangePicker({ options, onChange }) {
  const [mode, setMode] = useState(options[0].value);
  const [customFrom, setCustomFrom] = useState(daysAgoISO(30));
  const [customTo, setCustomTo] = useState(todayISO());

  const isCustom = mode === "custom";

  // The caller already initializes its own state to match this picker's
  // default (options[0].value), so re-announcing that same value on mount
  // just fires a second, redundant fetch - only notify on an actual change.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    onChange(isCustom ? { from: customFrom, to: customTo } : { range: mode });
    // onChange intentionally left out of deps - it's a fresh function each
    // render, we only want to re-run when the actual range values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, customFrom, customTo]);

  function handleModeChange(newMode) {
    setMode(newMode);
    if (newMode === "custom") {
      setCustomFrom(daysAgoISO(30));
      setCustomTo(todayISO());
    }
  }

  return (
    <div className="inline-form">
      {isCustom && (
        <>
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <span className="muted">→</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={todayISO()}
            onChange={(e) => setCustomTo(e.target.value)}
          />
        </>
      )}
      <Dropdown value={mode} options={options} onChange={handleModeChange} />
    </div>
  );
}
