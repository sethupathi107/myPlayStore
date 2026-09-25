import { Download, Check } from "lucide-react";
import { useInstalls } from "../context/InstallContext";

// Same behaviour everywhere an app appears (hero, lists, detail page) -
// backed by the shared InstallContext so state never gets out of sync
// between two instances showing the same app.
export function InstallButton({ app, size, className = "" }) {
  const { installs, install } = useInstalls();
  const state = installs[app.id];
  const isInstalling = state?.status === "installing";
  const isInstalled = state?.status === "installed";

  return (
    <button
      type="button"
      className={`btn btn-primary btn-pill install-btn ${isInstalled ? "is-installed" : ""} ${
        size === "small" ? "btn-small" : ""
      } ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        install(app);
      }}
    >
      <span className="install-btn-fill" style={{ transform: `scaleX(${(state?.progress || 0) / 100})` }} />
      <span className="install-btn-label">
        {isInstalled ? (
          <>
            <Check size={16} /> Open
          </>
        ) : isInstalling ? (
          `Installing ${state.progress}%`
        ) : (
          <>
            <Download size={16} /> Get
          </>
        )}
      </span>
    </button>
  );
}
