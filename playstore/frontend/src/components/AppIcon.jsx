import { accentFor } from "../lib/accents";

export function AppIcon({ seed, letter, size = "medium", iconUrl, style }) {
  if (iconUrl) {
    return (
      <div className={`app-icon app-icon-${size} app-icon-image`} style={style}>
        <img src={iconUrl} alt="" />
      </div>
    );
  }

  const accent = accentFor(seed || letter || "?");
  return (
    <div className={`app-icon app-icon-${size}`} style={{ ...accent, ...style }}>
      {letter}
    </div>
  );
}
