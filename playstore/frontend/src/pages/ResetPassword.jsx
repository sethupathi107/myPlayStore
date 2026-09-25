import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, errorMessage } from "../api";
import { ErrorMessage } from "../components/Loading";
import { AuthPanel } from "../components/AuthPanel";

export function ResetPassword() {
  const navigate = useNavigate();
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await authApi.resetPassword(resetToken, newPassword);
      navigate("/login", { replace: true });
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
          <h1>Reset password.</h1>
          <p>Paste the token from your email and choose a new password.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="reset-token">Reset token</label>
            <input
              id="reset-token"
              type="text"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Paste the token from your email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <ErrorMessage message={error} />

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Reset password"}
          </button>
        </form>
      </div>

      <AuthPanel />
    </div>
  );
}
