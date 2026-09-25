import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { appsApi, categoriesApi } from "../api";
import { useInfiniteApps } from "../lib/useInfiniteApps";
import { AppCard } from "../components/AppCard";
import { Loading, LoadingMore, ErrorMessage } from "../components/Loading";

export function CategoryApps() {
  const { id } = useParams();
  const [categoryName, setCategoryName] = useState("");

  useEffect(() => {
    categoriesApi
      .list()
      .then((categories) => {
        const match = categories.find((c) => c.id === id);
        setCategoryName(match?.name || "Category");
      })
      .catch(() => {});
  }, [id]);

  const { apps, loading, error, hasMore, sentinelRef } = useInfiniteApps(
    (page, limit) => appsApi.list(page, limit, { categoryId: id }),
    id
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>{categoryName}</h1>
        <Link to="/">← Back to Discover</Link>
      </div>

      <ErrorMessage message={error} />

      {!loading && !error && apps.length === 0 && (
        <p className="status-text">No apps in this category yet.</p>
      )}

      <div className="app-grid">
        {apps.map((app) => (
          <AppCard key={app.id} app={{ ...app, categoryName }} />
        ))}
      </div>

      {loading && apps.length === 0 && <Loading text="Loading apps…" />}
      {loading && apps.length > 0 && <LoadingMore />}
      {hasMore && !loading && <div ref={sentinelRef} />}
    </div>
  );
}
