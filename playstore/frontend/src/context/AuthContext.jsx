import { createContext, useContext, useEffect, useState } from "react";
import {
  authApi,
  decodeToken,
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
} from "../api";

// Holds "who is logged in" for the whole app, backed by the JWT stored in
// localStorage. The token itself already tells us {id, email, role}, so we
// just decode it instead of asking the backend for a separate profile.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = getAccessToken();
    return token ? decodeToken(token) : null;
  });

  // Keep `user` in sync if the token changes in another tab.
  useEffect(() => {
    function handleStorageChange() {
      const token = getAccessToken();
      setUser(token ? decodeToken(token) : null);
    }
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  async function signup(name, email, password) {
    const data = await authApi.signup(name, email, password);
    saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(decodeToken(data.accessToken));
    return data;
  }

  async function login(email, password) {
    const data = await authApi.signin(email, password);
    saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(decodeToken(data.accessToken));
    return data;
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Even if the server call fails, still log the user out locally.
    }
    clearTokens();
    setUser(null);
  }

  const value = { user, isAdmin: user?.role === "admin", signup, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
