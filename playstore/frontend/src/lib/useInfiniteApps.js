import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api";

const PAGE_SIZE = 60;
// Loading the next batch always takes at least this long, even if the
// request itself is instant, so the loading animation at the bottom is
// actually visible rather than a flash. Only applied to "load more"
// (page > 1), never to the first load of a page.
const MIN_LOAD_MORE_MS = 1500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Loads a paginated apps endpoint as an infinite-scrolling list: keeps
// appending pages instead of replacing them, and fetches the next page
// automatically once a "sentinel" element (attached via the returned
// sentinelRef) scrolls into view.
//
// `fetchPage(page, limit)` must resolve to { results, total }.
// `resetKey` - when it changes (e.g. switching category), the list starts
// over from page 1 instead of appending.
export function useInfiniteApps(fetchPage, resetKey) {
  const [apps, setApps] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setApps([]);
    setPage(1);
    setTotal(0);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const request =
      page === 1 ? fetchPage(page, PAGE_SIZE) : Promise.all([fetchPage(page, PAGE_SIZE), wait(MIN_LOAD_MORE_MS)]).then(([data]) => data);

    request
      .then((data) => {
        if (cancelled) return;
        setApps((prev) => (page === 1 ? data.results : [...prev, ...data.results]));
        setTotal(data.total);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, resetKey]);

  const hasMore = apps.length < total;

  // Kept in a ref so the observer (created once per sentinel element)
  // always checks the latest values instead of a stale closure.
  const latest = useRef({ hasMore, loading });
  latest.current = { hasMore, loading };

  const observerRef = useRef(null);
  const sentinelRef = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;

    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && latest.current.hasMore && !latest.current.loading) {
        setPage((p) => p + 1);
      }
    });
    observerRef.current.observe(node);
  }, []);

  return { apps, total, loading, error, hasMore, sentinelRef };
}
