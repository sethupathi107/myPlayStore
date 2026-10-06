export function Loading({ text = "Loading…" }) {
  return <p className="status-text">{text}</p>;
}

// Used at the bottom of an infinite-scrolling list while the next batch
// loads - a real spinner, not just a text label, since it's on screen
// for a deliberate beat (see useInfiniteApps's MIN_LOAD_MORE_MS).
export function LoadingMore({ text = "Loading more apps…" }) {
  return (
    <div className="loading-more">
      <span className="spinner" />
      <span>{text}</span>
    </div>
  );
}

export function ErrorMessage({ message }) {
  if (!message) return null;
  return <p className="status-text status-error">{message}</p>;
}
