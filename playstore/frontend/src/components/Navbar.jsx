import { Link, NavLink } from "react-router-dom";
import { Compass, Search, Upload, User, LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ProfileMenu } from "./ProfileMenu";

const NAV_ITEMS = [
  { to: "/", label: "Discover", icon: Compass, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/apps/new", label: "Publish", icon: Upload },
  { to: "/account", label: "Profile", icon: User },
];

export function Navbar() {
  const { user, isAdmin } = useAuth();

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        hommer
      </Link>

      {user && (
        <>
          <nav className="navbar-nav">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `navbar-nav-item${isActive ? " is-active" : ""}`}
              >
                <Icon size={17} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin" className={({ isActive }) => `navbar-nav-item${isActive ? " is-active" : ""}`}>
                <LayoutDashboard size={17} strokeWidth={1.75} />
                Admin
              </NavLink>
            )}
          </nav>

          <ProfileMenu />
        </>
      )}
    </header>
  );
}
