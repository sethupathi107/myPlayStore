import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "hommer-motion";
const MotionContext = createContext(null);

function getInitialMotion() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "calm" || stored === "lively" || stored === "off" ? stored : "calm";
}

// Drives the [data-motion] attribute the CSS animation/transition durations
// key off of (see index.css). "off" is a real kill-switch, not just shorter
// durations - it disables every transition/animation via a blanket selector.
export function MotionProvider({ children }) {
  const [motion, setMotion] = useState(getInitialMotion);

  useEffect(() => {
    document.documentElement.setAttribute("data-motion", motion);
    localStorage.setItem(STORAGE_KEY, motion);
  }, [motion]);

  return <MotionContext.Provider value={{ motion, setMotion }}>{children}</MotionContext.Provider>;
}

export function useMotion() {
  const context = useContext(MotionContext);
  if (!context) throw new Error("useMotion must be used inside <MotionProvider>");
  return context;
}
