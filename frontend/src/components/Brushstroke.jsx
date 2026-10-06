// A loose decorative mark, not a precise icon - sits top-right on cobalt
// blocks (onboarding, auth panel, hero) per the visual system.
export function Brushstroke({ className = "brushstroke" }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <path
        d="M18 96C34 48 78 14 128 22c38 6 30 44 4 54-30 12-58-6-46-30 10-20 42-24 64-8"
        stroke="var(--yellow)"
        strokeWidth="10"
        strokeLinecap="round"
      />
    </svg>
  );
}
