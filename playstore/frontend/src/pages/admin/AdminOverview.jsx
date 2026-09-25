import { useEffect, useState } from "react";
import { adminApi, saveBlobAsFile, errorMessage } from "../../api";
import { Loading, ErrorMessage } from "../../components/Loading";
import { RangePicker } from "../../components/RangePicker";
import { CountUp } from "../../components/CountUp";
import { PieChart } from "../../components/PieChart";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

// A real day of bulk-seeded/simulated traffic can be orders of magnitude
// bigger than everything around it (e.g. 57,656 vs a normal day's ~100) -
// even a log scale still reads as "one huge bar, everything else tiny"
// when the gap is this extreme. Scaling against the second-highest day
// instead of the true max gives every normal day real visual variation;
// the one outlier just pins at 100% ("off the scale"), which is honest -
// its real number is still right there on hover.
function referenceMax(points) {
  const sorted = [...points.map((p) => p.count)].sort((a, b) => b - a);
  return Math.max(sorted[1] ?? sorted[0] ?? 1, 1);
}

function barHeightPercent(count, refMax) {
  if (refMax <= 0) return 6;
  return Math.min(100, Math.max(6, (count / refMax) * 85));
}

export function AdminOverview() {
  const [activity, setActivity] = useState(null);
  const [appsByCategory, setAppsByCategory] = useState(null);
  const [downloadsByCategory, setDownloadsByCategory] = useState(null);
  const [logs, setLogs] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [history, setHistory] = useState(null);
  const [historyParams, setHistoryParams] = useState({ range: "7d" });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError("");

    Promise.all([
      adminApi.activity(),
      adminApi.appsByCategory(),
      adminApi.downloadsByCategory(),
      adminApi.logs(20),
    ])
      .then(([activityData, appsData, downloadsData, logsData]) => {
        if (cancelled) return;
        setActivity(activityData);
        setAppsByCategory(appsData);
        setDownloadsByCategory(downloadsData);
        setLogs(logsData);
      })
      .catch((err) => !cancelled && setSummaryError(errorMessage(err)))
      .finally(() => !cancelled && setSummaryLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError("");

    adminApi
      .downloadsHistory(historyParams)
      .then((data) => !cancelled && setHistory(data))
      .catch((err) => !cancelled && setHistoryError(errorMessage(err)))
      .finally(() => !cancelled && setHistoryLoading(false));

    return () => {
      cancelled = true;
    };
  }, [historyParams]);

  async function handleExportLogs() {
    setExporting(true);
    try {
      const { blob, filename } = await adminApi.exportLogsCsv({ range: "7d" });
      saveBlobAsFile(blob, filename);
    } catch (err) {
      setSummaryError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="admin-panel">
      <span className="eyebrow">Admin · last 14 days</span>

      {summaryLoading && <Loading text="Loading dashboard…" />}
      <ErrorMessage message={summaryError} />

      {activity && (
        <div className="kpi-grid reveal">
          <div className="stat-block stat-cobalt">
            <span className="eyebrow">Total downloads</span>
            <span className="stat-block-value">
              <CountUp value={activity.totalDownloads} />
            </span>
          </div>
          <div className="stat-block stat-mint">
            <span className="eyebrow">Active customers</span>
            <span className="stat-block-value">
              <CountUp value={activity.totalUsers} />
            </span>
          </div>
          <div className="stat-block stat-yellow">
            <span className="eyebrow">Apps live</span>
            <span className="stat-block-value">
              <CountUp value={activity.totalApps} />
            </span>
          </div>
        </div>
      )}

      <section>
        <div className="page-header">
          <h2 className="headline-section">Downloads per day</h2>
          <div className="inline-form">
            <span className="tag">Redis · cached</span>
            <RangePicker options={RANGE_OPTIONS} onChange={setHistoryParams} />
          </div>
        </div>

        {historyLoading && <Loading text="Loading chart…" />}
        <ErrorMessage message={historyError} />

        {history && (
          <div className="bar-chart-scroll">
            <div className="bar-chart" style={{ minWidth: history.data.length * 54 }}>
              {history.data.map((point, i) => (
                <div key={point.date} className="bar-chart-column">
                  <div className="bar-chart-bar-area">
                    <div
                      className="bar-chart-bar"
                      style={{
                        height: `${barHeightPercent(point.count, referenceMax(history.data))}%`,
                        animationDelay: `${i * 35}ms`,
                      }}
                    >
                      <div className="bar-chart-tooltip">
                        {point.date}
                        <br />
                        {point.count} download{point.count === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <span className="bar-chart-label">{point.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {downloadsByCategory && (
        <section>
          <h2 className="headline-section">Downloads by category</h2>
          <div style={{ marginTop: 16 }}>
            <PieChart data={downloadsByCategory.categories} centerLabel="Downloads" />
          </div>
        </section>
      )}

      {appsByCategory && (
        <section>
          <h2 className="headline-section">Apps by category</h2>
          <div style={{ marginTop: 16 }}>
            <PieChart data={appsByCategory.categories} centerLabel="Apps" />
          </div>
        </section>
      )}

      <section>
        <div className="page-header">
          <h2 className="headline-section">Activity log</h2>
          <button className="btn btn-outline btn-small" onClick={handleExportLogs} disabled={exporting}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
        <div className="activity-log">
          {logs.map((log) => (
            <div key={log.id} className="activity-row">
              <span className="activity-time">{new Date(log.createdAt).toLocaleString()}</span>
              <span>{log.message}</span>
              <span className="activity-tag">LOG</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
