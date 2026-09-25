import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { adminApi, saveBlobAsFile, errorMessage } from "../../api";
import { ErrorMessage } from "../../components/Loading";
import { RangePicker } from "../../components/RangePicker";
import { useToast } from "../../context/ToastContext";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

export function AdminExports() {
  const [rangeParams, setRangeParams] = useState({ range: "7d" });
  const [jobs, setJobs] = useState([]); // session-only "past exports" list
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const timers = useRef({});
  const showToast = useToast();

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  function pollStatus(jobId) {
    timers.current[jobId] = setTimeout(async () => {
      try {
        const status = await adminApi.getExportJob(jobId);
        setJobs((current) => current.map((job) => (job.jobId === jobId ? { ...job, ...status } : job)));
        if (status.status === "queued" || status.status === "processing") {
          pollStatus(jobId);
        } else if (status.status === "done") {
          showToast("Export ready");
        }
      } catch (err) {
        setError(errorMessage(err));
      }
    }, 2000);
  }

  async function handleRequestExport() {
    setRequesting(true);
    setError("");
    try {
      const data = await adminApi.requestDownloadsExport(rangeParams);
      setJobs((current) => [{ jobId: data.jobId, type: "downloads", status: "queued" }, ...current]);
      pollStatus(data.jobId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRequesting(false);
    }
  }

  async function handleSyncDownload() {
    setSyncing(true);
    setError("");
    try {
      const { blob, filename } = await adminApi.downloadsExportSync(rangeParams);
      saveBlobAsFile(blob, filename);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  async function handleDownload(job) {
    setDownloadingId(job.jobId);
    setError("");
    try {
      const { blob, filename } = await adminApi.downloadExportJob(job.jobId);
      saveBlobAsFile(blob, filename);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="admin-panel">
      <div>
        <h2 className="headline-section">CSV exports</h2>
        <p style={{ marginTop: 8 }}>Exports run as background jobs. Leave the page — the file waits here.</p>
      </div>

      <div className="inline-form">
        <RangePicker options={RANGE_OPTIONS} onChange={setRangeParams} />
        <button className="btn btn-primary" onClick={handleRequestExport} disabled={requesting}>
          {requesting ? "Requesting…" : "New CSV export"}
        </button>
        <button className="btn btn-outline" onClick={handleSyncDownload} disabled={syncing}>
          {syncing ? "Downloading…" : "Sync download"}
        </button>
      </div>
      <p className="status-text">
        "New CSV export" runs in the background for large ranges. "Sync download" streams the file
        immediately instead — only use it for small ranges, the request blocks until it's done.
      </p>

      <ErrorMessage message={error} />

      <div>
        {jobs.map((job) => {
          const running = job.status === "queued" || job.status === "processing";
          const done = job.status === "done";
          return (
            <div key={job.jobId} className="offset-card export-job-row reveal" style={{ marginBottom: 12 }}>
              <span className="export-job-icon">
                <FileSpreadsheet size={20} />
              </span>
              <div className="export-job-body">
                <strong>{job.fileName || `${job.type}-${job.jobId.slice(0, 8)}.csv.gz`}</strong>
                <span className="eyebrow">
                  {done
                    ? `${(job.rowCount ?? 0).toLocaleString("en-IN")} rows`
                    : job.status === "failed"
                    ? job.error || "Failed"
                    : "Running…"}
                </span>
                <span className="export-job-track">
                  <span
                    className={`export-job-fill ${done ? "is-done" : ""}`}
                    style={{ width: done ? "100%" : running ? "55%" : "0%" }}
                  />
                </span>
              </div>
              <button
                className="btn btn-small"
                disabled={!done || downloadingId === job.jobId}
                style={{ opacity: done ? 1 : 0.4 }}
                onClick={() => handleDownload(job)}
              >
                {downloadingId === job.jobId ? "Downloading…" : "Download"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
