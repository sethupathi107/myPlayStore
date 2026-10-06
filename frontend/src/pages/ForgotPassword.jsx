import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi, errorMessage } from "../api";
import { ErrorMessage } from "../components/Loading";
import { AuthPanel } from "../components/AuthPanel";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const data = await authApi.forgotPassword(email);
      setMessage(data.message || "Check your email for a reset link.");
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
          <h1>Forgot password.</h1>
          <p>Enter your email and we'll send you a reset token.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="forgot-email">Email</label>
            <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <ErrorMessage message={error} />
          {message && <p className="status-text status-success">{message}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send reset token"}
          </button>
        </form>

        <div className="auth-meta-row">
          <span>Already have a token?</span>
          <Link to="/reset-password">Reset password</Link>
        </div>
      </div>

      <AuthPanel />
    </div>
  );
}
