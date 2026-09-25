import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, FileArchive, Images } from "lucide-react";
import { appsApi, categoriesApi, imagesApi, errorMessage } from "../api";
import { Loading, ErrorMessage } from "../components/Loading";

const STEPS = ["Fill the form", "We run basic checks", "Live on the shelf"];
const MAX_SCREENSHOTS = 8;

export function AppForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState(null);
  const [iconFile, setIconFile] = useState(null);
  const [screenshotFiles, setScreenshotFiles] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { id, submissionCode }

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    appsApi
      .getById(id)
      .then((app) => {
        if (cancelled) return;
        setName(app.name);
        setDescription(app.description || "");
        setCategoryId(app.categoryId);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEditing]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!isEditing && !file) {
      setError("Drop an APK or AAB to publish.");
      return;
    }
    if (!categoryId) {
      setError("Please choose a category.");
      return;
    }

    const formData = new FormData();
    if (isEditing) formData.append("id", id);
    formData.append("name", name);
    formData.append("categoryId", categoryId);
    formData.append("description", description);
    if (file) formData.append("appFile", file);

    setSubmitting(true);
    try {
      const saved = isEditing ? await appsApi.update(formData) : await appsApi.create(formData);

      if (iconFile) {
        await imagesApi.upload(saved.id, iconFile, { isIcon: true });
      }
      for (const screenshot of screenshotFiles) {
        await imagesApi.upload(saved.id, screenshot);
      }

      if (isEditing) {
        navigate(`/apps/${saved.id}`, { replace: true });
      } else {
        setSubmitted({ id: saved.id, code: `HM-${saved.id.slice(0, 5).toUpperCase()}` });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading text="Loading app…" />;

  if (submitted) {
    return (
      <div className="page page-narrow">
        <div className="publish-success reveal">
          <div className="publish-success-icon">
            <Check size={32} />
          </div>
          <span className="eyebrow">
            SUBMISSION #{submitted.code} · PUBLISHED
          </span>
          <h2 className="headline-section">It's live.</h2>
          <p>Your app is already on the shelf, right next to the ones you admire.</p>
          <div className="publish-success-actions">
            <button
              className="btn btn-cream"
              onClick={() => {
                setSubmitted(null);
                setName("");
                setDescription("");
                setCategoryId("");
                setFile(null);
                setIconFile(null);
                setScreenshotFiles([]);
              }}
            >
              Publish another
            </button>
            <Link className="btn btn-primary" to="/my-apps">
              See my apps
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const step1Done = Boolean(name && categoryId && description);

  return (
    <div className="page">
      <div className="publish-grid">
        <div className="publish-sticky reveal">
          <span className="eyebrow">Developer console</span>
          <h1 className="headline-section">
            Built something? <span className="accent-cobalt">Ship it.</span>
          </h1>
          <p>One form. It's checked automatically and published right away.</p>

          <div className="publish-steps">
            {STEPS.map((step, i) => (
              <div key={step} className={`publish-step ${i === 0 && step1Done ? "is-done" : ""}`}>
                <span className="publish-step-circle">{i + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="offset-card publish-card reveal">
          <div className="field">
            <label htmlFor="app-name">App name</label>
            <input id="app-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required />
          </div>

          <div className="field">
            <label htmlFor="app-category">Category</label>
            <select id="app-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="app-description">Short description</label>
            <textarea
              id="app-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              required
            />
          </div>

          <div className={`dropzone ${file || isEditing ? "is-filled" : ""}`}>
            <input type="file" onChange={(e) => setFile(e.target.files[0] || null)} accept=".apk,.aab" />
            <FileArchive size={22} />
            <span className="dropzone-text">
              <strong>{file ? file.name : isEditing ? "Replace APK or AAB (optional)" : "Drop APK or AAB"}</strong>
              <span>Up to 500 MB</span>
            </span>
            {(file || isEditing) && <Check size={18} color="var(--success)" style={{ marginLeft: "auto" }} />}
          </div>

          <div className={`dropzone ${iconFile ? "is-filled" : ""}`}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setIconFile(e.target.files[0] || null)} />
            <Images size={22} />
            <span className="dropzone-text">
              <strong>{iconFile ? iconFile.name : "App icon (optional)"}</strong>
              <span>PNG, JPG or WebP</span>
            </span>
            {iconFile && <Check size={18} color="var(--success)" style={{ marginLeft: "auto" }} />}
          </div>

          <div className={`dropzone ${screenshotFiles.length > 0 ? "is-filled" : ""}`}>
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={(e) => setScreenshotFiles([...e.target.files].slice(0, MAX_SCREENSHOTS))}
            />
            <Images size={22} />
            <span className="dropzone-text">
              <strong>{screenshotFiles.length > 0 ? `${screenshotFiles.length} screenshot(s) selected` : "Screenshots (optional)"}</strong>
              <span>PNG or JPG, up to {MAX_SCREENSHOTS}</span>
            </span>
            {screenshotFiles.length > 0 && <Check size={18} color="var(--success)" style={{ marginLeft: "auto" }} />}
          </div>

          <ErrorMessage message={error} />

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Uploading…" : isEditing ? "Save changes" : "Submit for review"}
          </button>
        </form>
      </div>
    </div>
  );
}
