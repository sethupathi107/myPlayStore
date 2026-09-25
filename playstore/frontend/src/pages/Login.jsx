import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/Loading";
import { AuthPanel } from "../components/AuthPanel";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = location.state?.from?.pathname || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-form-col reveal">
        <span className="navbar-brand">hommer</span>

        <div>
          <h1>Welcome back.</h1>
          <p>Sign in to pick up where you left off.</p>
        </div>

        <div className="segmented">
          <button type="button" className="is-active">
            Sign in
          </button>
          <button type="button" onClick={() => navigate("/signup")}>
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <ErrorMessage message={error} />

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="auth-meta-row">
          <span>JWT session · 7 days</span>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
      </div>

      <AuthPanel />
    </div>
  );
}
