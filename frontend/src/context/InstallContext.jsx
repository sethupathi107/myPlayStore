import { createContext, useCallback, useContext, useRef, useState } from "react";
import { appsApi, saveBlobAsFile, errorMessage } from "../api";
import { useToast } from "./ToastContext";

const InstallContext = createContext(null);
const SIMULATED_DURATION_MS = 1400;
const TICK_MS = 60;

// Install state is global per app id (per the spec: the same "Get"/progress/
// "Open" state must be reflected everywhere the app appears - hero, lists,
// detail page - not a separate local state per component instance).
export function InstallProvider({ children }) {
  const [installs, setInstalls] = useState({}); // { [appId]: { status, progress } }
  const timers = useRef({});
  const showToast = useToast();

  const install = useCallback(
    (app) => {
      const current = installs[app.id];
      if (current?.status === "installing") return;
      if (current?.status === "installed") {
        showToast(`Opening ${app.name}`);
        return;
      }

      setInstalls((prev) => ({ ...prev, [app.id]: { status: "installing", progress: 0 } }));

      const startedAt = Date.now();
      timers.current[app.id] = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(100, Math.round((elapsed / SIMULATED_DURATION_MS) * 100));
        setInstalls((prev) => ({ ...prev, [app.id]: { status: "installing", progress } }));
        if (progress >= 100) {
          clearInterval(timers.current[app.id]);
          setInstalls((prev) => ({ ...prev, [app.id]: { status: "installed", progress: 100 } }));
          showToast(`${app.name} installed`);
        }
      }, TICK_MS);

      // Fire the real download alongside the simulated progress bar, so
      // "Get" both looks right and actually saves the file - a failure here
      // doesn't interrupt the visual state, it just skips the real file.
      appsApi.download(app.id).then(
        ({ blob, filename }) => saveBlobAsFile(blob, filename || app.name),
        (err) => showToast(errorMessage(err))
      );
    },
    [installs, showToast]
  );

  const installedCount = Object.values(installs).filter((entry) => entry.status === "installed").length;

  return (
    <InstallContext.Provider value={{ installs, install, installedCount }}>{children}</InstallContext.Provider>
  );
}

export function useInstalls() {
  const context = useContext(InstallContext);
  if (!context) throw new Error("useInstalls must be used inside <InstallProvider>");
  return context;
}
