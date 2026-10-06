import { NavLink, Outlet } from "react-router-dom";

export function AdminLayout() {
  return (
    <div className="page">
      <div>
        <span className="eyebrow">Admin · store health</span>
        <h1 className="headline-section">Store health</h1>
      </div>
      <nav className="admin-tabs">
        <NavLink to="/admin" end className={({ isActive }) => (isActive ? "is-active" : "")}>
          Overview
        </NavLink>
        <NavLink to="/admin/exports" className={({ isActive }) => (isActive ? "is-active" : "")}>
          CSV exports
        </NavLink>
        <NavLink to="/admin/categories" className={({ isActive }) => (isActive ? "is-active" : "")}>
          Categories
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
