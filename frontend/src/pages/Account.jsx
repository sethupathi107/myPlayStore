import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { authApi, appsApi, getRefreshToken, errorMessage } from "../api";
import { useAuth } from "../context/AuthContext";
import { useInstalls } from "../context/InstallContext";
import { ErrorMessage } from "../components/Loading";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AppIcon } from "../components/AppIcon";
import { CountUp } from "../components/CountUp";
import { countReviewsWritten } from "../lib/mockApi";

export function Account() {
  const { user, logout } = useAuth();
  const { installedCount } = useInstalls();
  const navigate = useNavigate();

  const [myApps, setMyApps] = useState([]);
  const [publishedTotal, setPublishedTotal] = useState(0);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    appsApi
      .list(1, 50, { mine: true })
      .then((data) => {
        setMyApps(data.results);
        setPublishedTotal(data.total);
      })
      .catch(() => {});
  }, []);

  async function handleLogoutAll() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const refreshToken = getRefreshToken();
      await authApi.logoutAll(refreshToken);
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setChangingPassword(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(errorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  }

  async function confirmDeleteAccount() {
    setConfirmingDelete(false);
    setBusy(true);
    setError("");
    try {
      await authApi.deleteAccount(password);
      await logout();
      navigate("/signup", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const initial = user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="page">
      <div className="profile-header reveal">
        <div className="profile-avatar-lg">{initial}</div>
        <div className="profile-header-body">
          <span className="eyebrow">Customer{myApps.length > 0 ? " · Developer" : ""}</span>
          <h1 className="headline-section">{user?.email}</h1>
        </div>
        <button
          className="btn btn-outline"
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>

      <ErrorMessage message={error} />
      {message && <p className="status-text status-success">{message}</p>}

      <div className="stat-grid reveal">
        <div className="stat-block stat-cobalt">
          <span className="eyebrow">Installed</span>
          <span className="stat-block-value">
            <CountUp value={installedCount} />
          </span>
        </div>
        <div className="stat-block stat-mint">
          <span className="eyebrow">Published</span>
          <span className="stat-block-value">
            <CountUp value={publishedTotal} />
          </span>
        </div>
        <div className="stat-block stat-pink">
          <span className="eyebrow">Reviews written</span>
          <span className="stat-block-value">
            <CountUp value={countReviewsWritten()} />
          </span>
        </div>
      </div>

      <div className="profile-grid">
        <section>
          <h2 className="headline-section">My published apps</h2>
          {myApps.length === 0 && <p className="status-text" style={{ marginTop: 12 }}>You haven't published anything yet.</p>}
          <div style={{ marginTop: 16 }}>
            {myApps.map((app) => (
              <div key={app.id} className="app-row">
                <AppIcon seed={app.id} letter={app.name[0]?.toUpperCase()} />
                <div className="app-row-body">
                  <span className="app-row-name">{app.name}</span>
                  <span className="app-row-tagline">{app.description}</span>
                </div>
                <span className="status-chip is-live">Live</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="headline-section">Settings</h2>

          <div style={{ marginTop: 12 }}>
            <h3>Change password</h3>
            <form onSubmit={handleChangePassword}>
              <div className="field">
                <label htmlFor="current-password">Current password</label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <ErrorMessage message={passwordError} />
              {passwordMessage && <p className="status-text status-success">{passwordMessage}</p>}

              <button className="btn btn-primary" type="submit" disabled={changingPassword}>
                {changingPassword ? "Changing…" : "Change password"}
              </button>
            </form>
          </div>

          <div style={{ marginTop: 28 }}>
            <h3>Sessions</h3>
            <p style={{ marginBottom: 12 }}>Log out of every device this account is signed in on.</p>
            <button className="btn btn-outline" onClick={handleLogoutAll} disabled={busy}>
              Log out everywhere
            </button>
          </div>

          <div style={{ marginTop: 28 }}>
            <h3>Delete account</h3>
            <p style={{ marginBottom: 12 }}>This permanently removes your account. Confirm with your password.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmingDelete(true);
              }}
            >
              <div className="field">
                <label htmlFor="delete-password">Password</label>
                <input
                  id="delete-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-danger" type="submit" disabled={busy}>
                Delete my account
              </button>
            </form>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete account"
        message="Delete your account permanently? This cannot be undone."
        confirmLabel="Delete account"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
