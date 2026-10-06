import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { MotionProvider } from "./context/MotionContext";
import { ToastProvider } from "./context/ToastContext";
import { InstallProvider } from "./context/InstallContext";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { AuthLayout } from "./components/AuthLayout";

import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Home } from "./pages/Home";
import { MyApps } from "./pages/MyApps";
import { CategoryApps } from "./pages/CategoryApps";
import { Search } from "./pages/Search";
import { AppDetail } from "./pages/AppDetail";
import { AppForm } from "./pages/AppForm";
import { Account } from "./pages/Account";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { AdminExports } from "./pages/admin/AdminExports";
import { AdminCategories } from "./pages/admin/AdminCategories";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <MotionProvider>
      <ToastProvider>
        <InstallProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route element={<AuthLayout />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/hot" element={<Navigate to="/" replace />} />
                    <Route path="/my-apps" element={<MyApps />} />
                    <Route path="/category/:id" element={<CategoryApps />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/apps/new" element={<AppForm />} />
                    <Route path="/apps/:id" element={<AppDetail />} />
                    <Route path="/apps/:id/edit" element={<AppForm />} />
                    <Route path="/account" element={<Account />} />

                    <Route element={<AdminRoute />}>
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<AdminOverview />} />
                        <Route path="exports" element={<AdminExports />} />
                        <Route path="categories" element={<AdminCategories />} />
                      </Route>
                    </Route>
                  </Route>
                </Route>

                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </InstallProvider>
      </ToastProvider>
    </MotionProvider>
  );
}
