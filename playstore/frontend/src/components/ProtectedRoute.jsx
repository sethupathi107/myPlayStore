import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wraps every page that needs a logged-in user. If nobody is logged in,
// bounce to /login and remember where they were headed.
export function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// Wraps admin-only pages (e.g. /admin/*). This is just a UX nicety - the
// backend's own requireAdmin middleware is the real security boundary.
export function AdminRoute() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
