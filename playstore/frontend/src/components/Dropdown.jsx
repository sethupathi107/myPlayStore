import { useEffect, useRef, useState } from "react";

// A small custom dropdown menu (button + floating list), used instead of a
// plain native <select> wherever the menu needs to look like part of the
// app instead of the browser's own popup.
export function Dropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value);

  return (
    <div className="dropdown" ref={rootRef}>
      <button type="button" className="dropdown-trigger" onClick={() => setOpen((o) => !o)}>
        {selected?.label ?? "Select…"}
        <span className="dropdown-caret">▾</span>
      </button>

      {open && (
        <ul className="dropdown-menu">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="dropdown-check">{option.value === value ? "✓" : ""}</span>
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
