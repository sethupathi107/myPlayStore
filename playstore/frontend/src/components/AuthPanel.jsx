import { useEffect, useState } from "react";
import { Smartphone, Music, Camera, Gamepad2, Wallet, Palette } from "lucide-react";
import { appsApi } from "../api";
import { CountUp } from "./CountUp";
import { Brushstroke } from "./Brushstroke";
import { accentFor } from "../lib/accents";

const TILE_ICONS = [Smartphone, Music, Camera, Gamepad2, Wallet, Palette];
const TILE_SEEDS = ["tile-0", "tile-1", "tile-2", "tile-3", "tile-4", "tile-5"];

// The cobalt right-hand panel on every auth screen: a real count of apps in
// the catalog (not a fabricated number), a loose grid of tilted icon tiles,
// and the brushstroke mark. Shared so Login/Signup/Forgot/Reset all look
// identical instead of drifting apart.
export function AuthPanel() {
  // GET /v1/app requires auth, so a genuinely anonymous visitor here can
  // never fetch a real count - null (not 0) distinguishes "don't know yet /
  // couldn't ask" from an honest "the catalog really is empty", so the
  // number only ever renders when it's real.
  const [total, setTotal] = useState(null);

  useEffect(() => {
    appsApi
      .list(1, 1)
      .then((data) => setTotal(data.total ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className="auth-panel">
      <Brushstroke />

      <div className="auth-tile-grid reveal">
        {TILE_SEEDS.map((seed, i) => {
          const accent = accentFor(seed);
          // no cobalt tiles on the cobalt panel - skip that accent pair here
          const isCobalt = accent.background === "var(--cobalt)";
          const Icon = TILE_ICONS[i];
          return (
            <div key={seed} className="auth-tile" style={isCobalt ? { background: "var(--mint)", color: "var(--olive)" } : accent}>
              <Icon size={26} strokeWidth={1.75} />
            </div>
          );
        })}
      </div>

      <div>
        {total !== null && (
          <div className="auth-panel-count">
            <CountUp value={total} />
          </div>
        )}
        <p className="auth-panel-caption">
          {total !== null ? "apps live. " : ""}Every one opened and tested by a person.
        </p>
      </div>
    </div>
  );
}
