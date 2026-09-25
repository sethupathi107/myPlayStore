import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "./AppIcon";
import { InstallButton } from "./InstallButton";
import { imagesApi } from "../api";
import { withMockCatalogFields } from "../lib/mockApi";

// A single app row, used across Discover, Search, My apps and Category
// pages. Real fields (name/description/category) pass through as-is;
// tagline/rating are deterministic stand-ins until the catalog grows those
// columns (see lib/mockApi.js).
export function AppCard({ app: rawApp }) {
  const app = withMockCatalogFields(rawApp);
  const initial = app.name?.[0]?.toUpperCase() || "?";
  const [iconUrl, setIconUrl] = useState(null);

  useEffect(() => {
    if (!app.iconImageId) {
      setIconUrl(null);
      return;
    }
    let objectUrl = null;
    imagesApi
      .getObjectUrl(app.id, app.iconImageId)
      .then((url) => {
        objectUrl = url;
        setIconUrl(url);
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [app.id, app.iconImageId]);

  return (
    <Link to={`/apps/${app.id}`} className="app-row">
      <AppIcon seed={app.id || app.name} letter={initial} iconUrl={iconUrl} />
      <div className="app-row-body">
        <span className="app-row-name">{app.name}</span>
        <span className="app-row-tagline">{app.description || app.tagline}</span>
        <span className="app-row-meta">
          <span>{app.categoryName || app.category?.name || "Uncategorized"}</span>
          <span>★ {app.rating}</span>
        </span>
      </div>
      <InstallButton app={app} size="small" />
    </Link>
  );
}
