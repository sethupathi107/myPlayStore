import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { appsApi, categoriesApi } from "../api";
import { useInfiniteApps } from "../lib/useInfiniteApps";
import { AppCard } from "../components/AppCard";
import { Loading, LoadingMore, ErrorMessage } from "../components/Loading";

export function MyApps() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  const { apps, loading, error, hasMore, sentinelRef } = useInfiniteApps((page, limit) =>
    appsApi.list(page, limit, { mine: true })
  );

  const categoryNameById = useMemo(() => {
    const map = {};
    for (const category of categories) map[category.id] = category.name;
    return map;
  }, [categories]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>My apps</h1>
        <Link className="btn btn-primary" to="/apps/new">
          Upload a new app
        </Link>
      </div>

      <ErrorMessage message={error} />

      {!loading && !error && apps.length === 0 && (
        <p className="status-text">
          You haven't uploaded anything yet. <Link to="/apps/new">Upload your first app</Link>.
        </p>
      )}

      <div className="app-grid">
        {apps.map((app) => (
          <AppCard key={app.id} app={{ ...app, categoryName: categoryNameById[app.categoryId] }} />
        ))}
      </div>

      {loading && apps.length === 0 && <Loading text="Loading your apps…" />}
      {loading && apps.length > 0 && <LoadingMore />}
      {hasMore && !loading && <div ref={sentinelRef} />}
    </div>
  );
}
