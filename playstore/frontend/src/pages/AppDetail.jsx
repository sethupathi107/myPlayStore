import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { appsApi, categoriesApi, imagesApi, errorMessage } from "../api";
import { useAuth } from "../context/AuthContext";
import { Loading, ErrorMessage } from "../components/Loading";
import { AppCard } from "../components/AppCard";
import { AppIcon } from "../components/AppIcon";
import { InstallButton } from "../components/InstallButton";
import { StarRating } from "../components/StarRating";
import { CountUp } from "../components/CountUp";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../context/ToastContext";
import { withMockCatalogFields, formatBytes, listReviews, ratingSummary, submitReview } from "../lib/mockApi";
import { revealDelay } from "../lib/reveal";

const STAR_LABELS = [5, 4, 3, 2, 1];

export function AppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const showToast = useToast();

  const [app, setApp] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [images, setImages] = useState([]);
  const [iconUrl, setIconUrl] = useState(null);
  const [similarApps, setSimilarApps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [myRating, setMyRating] = useState(0);
  const [myReviewText, setMyReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef(null);
  const iconInputRef = useRef(null);

  const canManage = app && user && (app.userId === user.id || isAdmin);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    async function load() {
      setLoading(true);
      setError("");
      try {
        const appData = await appsApi.getById(id);
        if (cancelled) return;
        setApp(appData);
        setIconUrl(null);

        if (appData.iconImageId) {
          imagesApi
            .getObjectUrl(id, appData.iconImageId)
            .then((url) => {
              if (cancelled) {
                URL.revokeObjectURL(url);
                return;
              }
              objectUrls.push(url);
              setIconUrl(url);
            })
            .catch(() => {});
        }

        categoriesApi
          .list()
          .then((categories) => {
            const match = categories.find((c) => c.id === appData.categoryId);
            if (!cancelled) setCategoryName(match?.name || "Uncategorized");
          })
          .catch(() => {});

        appsApi
          .list(1, 6, { categoryId: appData.categoryId, excludeId: appData.id })
          .then((data) => !cancelled && setSimilarApps(data.results))
          .catch(() => {});

        ratingSummary(id).then((data) => !cancelled && setSummary(data));
        listReviews(id).then((data) => !cancelled && setReviews(data));

        const imageList = await imagesApi.list(id);
        const settled = await Promise.allSettled(
          imageList.map(async (image) => {
            const url = await imagesApi.getObjectUrl(id, image.id);
            objectUrls.push(url);
            return { ...image, url };
          })
        );
        const withUrls = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
        if (!cancelled) setImages(withUrls);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [id]);

  async function handleDelete() {
    setConfirmingDelete(false);
    setBusy(true);
    setError("");
    try {
      await appsApi.remove(id);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function handleAddScreenshot(event) {
    const file = event.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const newImage = await imagesApi.upload(id, file);
      const url = await imagesApi.getObjectUrl(id, newImage.id);
      setImages((current) => [...current, { ...newImage, url }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveScreenshot(imageId) {
    setBusy(true);
    setError("");
    try {
      await imagesApi.remove(id, imageId);
      setImages((current) => current.filter((image) => image.id !== imageId));
      if (app.iconImageId === imageId) {
        setApp((current) => ({ ...current, iconImageId: null }));
        setIconUrl(null);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadIcon(event) {
    const file = event.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const newImage = await imagesApi.upload(id, file, { isIcon: true });
      const url = await imagesApi.getObjectUrl(id, newImage.id);
      setImages((current) => [...current, { ...newImage, url }]);
      setApp((current) => ({ ...current, iconImageId: newImage.id }));
      setIconUrl(url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (iconInputRef.current) iconInputRef.current.value = "";
    }
  }

  async function handleSubmitReview(event) {
    event.preventDefault();
    if (!myRating) return;
    setSubmittingReview(true);
    try {
      await submitReview(id, { rating: myRating, text: myReviewText, name: user?.email?.split("@")[0] || "You" });
      const [nextSummary, nextReviews] = await Promise.all([ratingSummary(id), listReviews(id)]);
      setSummary(nextSummary);
      setReviews(nextReviews);
      setMyRating(0);
      setMyReviewText("");
      showToast("Review posted");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) return <Loading text="Loading app…" />;
  if (error && !app) return <ErrorMessage message={error} />;
  if (!app) return null;

  const enriched = withMockCatalogFields(app);
  const maxBarCount = summary ? Math.max(1, ...STAR_LABELS.map((s) => summary.breakdown[s] || 0)) : 1;

  return (
    <div className="page">
      <Link to="/" className="back-link reveal">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="app-detail-header reveal">
        <div className="app-detail-icon-wrap">
          <AppIcon seed={app.id} letter={app.name[0]?.toUpperCase()} iconUrl={iconUrl} />
        </div>
        <div className="app-detail-meta">
          <span className="eyebrow">
            {categoryName} · VERSION {enriched.version}
          </span>
          <h1 className="app-detail-name">{app.name}</h1>
          <p className="app-detail-tagline">
            {enriched.tagline} · {enriched.developerName}
          </p>
          <div className="app-detail-actions">
            <InstallButton app={enriched} />
            {canManage && (
              <>
                <Link className="btn btn-outline" to={`/apps/${id}/edit`}>
                  Edit
                </Link>
                <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <ErrorMessage message={error} />

      <div className="stat-grid reveal">
        <div className="stat-block stat-pink">
          <span className="eyebrow">Rating</span>
          <span className="stat-block-value">{summary ? summary.average.toFixed(1) : "—"}</span>
        </div>
        <div className="stat-block stat-mint">
          <span className="eyebrow">Downloads</span>
          <span className="stat-block-value">
            <CountUp value={app.downloads ?? 0} />
          </span>
        </div>
        <div className="stat-block stat-cream-deep">
          <span className="eyebrow">Size</span>
          <span className="stat-block-value" style={{ fontSize: 28 }}>
            {formatBytes(enriched.size)}
          </span>
        </div>
        <div className="stat-block stat-cobalt">
          <span className="eyebrow">Version</span>
          <span className="stat-block-value" style={{ fontSize: 28 }}>
            {enriched.version}
          </span>
        </div>
      </div>

      {images.length > 0 && (
        <section>
          <h2 className="headline-section">Screenshots</h2>
          <div className="screenshot-row" style={{ marginTop: 16 }}>
            {images.map((image) => (
              <div key={image.id} className="screenshot">
                <img src={image.url} alt={`Screenshot of ${app.name}`} />
                {canManage && (
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => handleRemoveScreenshot(image.id)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="detail-columns">
        <section>
          <h2 className="headline-section">About</h2>
          <p style={{ marginTop: 12 }}>{app.description}</p>
          <div className="whats-new-box">
            <span className="eyebrow">What's new · {enriched.version}</span>
            <p style={{ marginTop: 8, color: "var(--olive)" }}>{enriched.whatsNew}</p>
          </div>
        </section>

        <section className="rating-summary">
          <h2 className="headline-section">Ratings</h2>
          {summary && (
            <>
              <div className="rating-average">
                <span className="rating-average-value">{summary.average.toFixed(1)}</span>
                <StarRating value={summary.average} />
                <span className="muted">{summary.count} reviews</span>
              </div>

              <div className="rating-bars">
                {STAR_LABELS.map((star) => (
                  <div key={star} className="rating-bar-row">
                    <span>{star}★</span>
                    <span className="rating-bar-track">
                      <span
                        className="rating-bar-fill"
                        style={{ width: `${((summary.breakdown[star] || 0) / maxBarCount) * 100}%` }}
                      />
                    </span>
                    <span>{summary.breakdown[star] || 0}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <form onSubmit={handleSubmitReview} style={{ gap: 10 }}>
            <span className="eyebrow">Write a review</span>
            <StarRating value={myRating} onChange={setMyRating} size={22} />
            <textarea
              rows={2}
              placeholder="What did you think?"
              value={myReviewText}
              onChange={(e) => setMyReviewText(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={!myRating || submittingReview}>
              {submittingReview ? "Posting…" : "Post review"}
            </button>
          </form>

          {reviews.map((review) => (
            <div key={review.id} className="review-row">
              <div className="review-row-head">
                <span className="review-name">{review.name}</span>
                <StarRating value={review.stars} size={13} />
              </div>
              <p>{review.text}</p>
            </div>
          ))}
        </section>
      </div>

      {canManage && (
        <div className="owner-tools">
          <span className="eyebrow">Owner tools</span>
          <div className="inline-form">
            <label className="btn btn-outline">
              {iconUrl ? "Change icon" : "Add icon"}
              <input
                ref={iconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUploadIcon}
                hidden
              />
            </label>
            <label className="btn btn-outline">
              Add screenshot
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAddScreenshot}
                hidden
              />
            </label>
          </div>
        </div>
      )}

      {similarApps.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="headline-section">Similar apps</h2>
          </div>
          <div className="app-grid reveal">
            {similarApps.map((similar) => (
              <AppCard key={similar.id} app={{ ...similar, categoryName }} />
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete app"
        message={`Delete "${app.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
