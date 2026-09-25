import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderKanban, UploadCloud, Settings, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// The avatar in the navbar - opens a dropdown with the account's own pages
// (My apps and Upload app, both hidden for admins), Account settings, and
// admin/logout.
export function ProfileMenu() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/login");
  }

  const initial = user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="dropdown" ref={rootRef}>
      <button type="button" className="navbar-avatar" onClick={() => setOpen((o) => !o)}>
        {initial}
      </button>

      {open && (
        <ul className="dropdown-menu profile-menu">
          <li className="profile-menu-name">{user?.email}</li>
          {!isAdmin && (
            <li>
              <Link className="dropdown-item" to="/my-apps" onClick={() => setOpen(false)}>
                <FolderKanban size={16} /> My apps
              </Link>
            </li>
          )}
          {!isAdmin && (
            <li>
              <Link className="dropdown-item" to="/apps/new" onClick={() => setOpen(false)}>
                <UploadCloud size={16} /> Publish an app
              </Link>
            </li>
          )}
          <li>
            <Link className="dropdown-item" to="/account" onClick={() => setOpen(false)}>
              <Settings size={16} /> Account settings
            </Link>
          </li>
          {isAdmin && (
            <li>
              <Link className="dropdown-item" to="/admin" onClick={() => setOpen(false)}>
                <LayoutDashboard size={16} /> Admin
              </Link>
            </li>
          )}
          <li>
            <button type="button" className="dropdown-item" onClick={handleLogout}>
              <LogOut size={16} /> Log out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
