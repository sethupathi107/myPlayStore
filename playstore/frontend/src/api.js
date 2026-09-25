// api.js
//
// Every call to the backend lives here in one plain file, using axios.
// No interceptor magic beyond one small "if the token expired, refresh it
// once and try again" helper - simple enough to read top to bottom.

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "/v1";

const api = axios.create({ baseURL: BASE_URL });

// ---------------------------------------------------------------------
// token helpers (stored in localStorage so a page refresh keeps you logged in)
// ---------------------------------------------------------------------
export function getAccessToken() {
  return localStorage.getItem("accessToken");
}

export function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}

export function saveTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

// The access token is a JWT: header.payload.signature, base64-encoded.
// We only need the payload ({id, email, role}) to know who is logged in,
// so just decode it - no need for a JWT library for that.
export function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function authHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Runs an authenticated request. If it fails with 401 (expired access
// token), tries to refresh the access token once and retries the same
// request, then gives up and throws.
async function withAuth(makeRequest) {
  try {
    return await makeRequest();
  } catch (error) {
    if (error.response?.status !== 401) throw error;

    const refreshToken = getRefreshToken();
    if (!refreshToken) throw error;

    try {
      const { data } = await api.post("/sign/refresh-token", { refreshToken });
      saveTokens({ accessToken: data.accessToken });
    } catch {
      clearTokens();
      throw error;
    }

    return makeRequest();
  }
}

// Turns a backend error response into a plain readable message.
export function errorMessage(error) {
  return (
    error.response?.data?.message ||
    error.response?.data?.errors?.[0]?.message ||
    error.message ||
    "Something went wrong"
  );
}

// -----------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------
export const authApi = {
  signup: (name, email, password) =>
    api.post("/sign/signup", { name, email, password }).then((r) => r.data),

  signin: (email, password) =>
    api.post("/sign/signin", { email, password }).then((r) => r.data),

  logout: (refreshToken) => api.post("/sign/logout", { refreshToken }).then((r) => r.data),

  logoutAll: (refreshToken) =>
    withAuth(() =>
      api
        .post("/sign/logout-all", { refreshToken }, { headers: authHeaders() })
        .then((r) => r.data)
    ),

  forgotPassword: (email) => api.post("/sign/forgot-password", { email }).then((r) => r.data),

  resetPassword: (resetToken, newPassword) =>
    api.post("/sign/reset-password", { resetToken, newPassword }).then((r) => r.data),

  deleteAccount: (password) =>
    withAuth(() =>
      api
        .delete("/sign/delete-account", { data: { password }, headers: authHeaders() })
        .then((r) => r.data)
    ),

  changePassword: (currentPassword, newPassword) =>
    withAuth(() =>
      api
        .patch("/sign/change-password", { currentPassword, newPassword }, { headers: authHeaders() })
        .then((r) => r.data)
    ),
};

// -----------------------------------------------------------------------
// Apps
// -----------------------------------------------------------------------
export const appsApi = {
  // The backend never returns every app in one response - it's paginated
  // the same way /app/search is: { total, page, limit, results }.
  // `extra` can carry { categoryId, mine, excludeId } to narrow the list.
  list: (page = 1, limit = 20, extra = {}) =>
    withAuth(() =>
      api
        .get("/app/", { params: { page, limit, ...extra }, headers: authHeaders() })
        .then((r) => r.data)
    ),

  search: (q, categoryId, page = 1, limit = 20) =>
    withAuth(() =>
      api
        .get("/app/search", { params: { q, categoryId, page, limit }, headers: authHeaders() })
        .then((r) => r.data)
    ),

  // Most-downloaded apps overall, ranked by real download count.
  hot: (limit = 10) =>
    withAuth(() =>
      api.get("/app/hot", { params: { limit }, headers: authHeaders() }).then((r) => r.data)
    ),

  // Same ranking, split per category: { categories: [{categoryId, categoryName, apps}] }.
  hotByCategory: (limit = 5) =>
    withAuth(() =>
      api
        .get("/app/hot-by-category", { params: { limit }, headers: authHeaders() })
        .then((r) => r.data)
    ),

  // Trending: ranked by downloads within just the last `days` (default 7),
  // not all-time - a different, faster-moving list than hot().
  trending: (days = 7, limit = 10) =>
    withAuth(() =>
      api
        .get("/app/trending", { params: { days, limit }, headers: authHeaders() })
        .then((r) => r.data)
    ),

  // Same split-per-category shape as hotByCategory(), but each category's
  // apps are ranked by recent (last `days`) downloads instead of all-time.
  trendingByCategory: (days = 7, limit = 5) =>
    withAuth(() =>
      api
        .get("/app/trending-by-category", { params: { days, limit }, headers: authHeaders() })
        .then((r) => r.data)
    ),

  getById: (applicationId) =>
    withAuth(() =>
      api
        .get("/app/id", { params: { applicationId }, headers: authHeaders() })
        .then((r) => r.data)
    ),

  create: (formData) =>
    withAuth(() =>
      api
        .post("/app/", formData, { headers: { ...authHeaders(), "Content-Type": "multipart/form-data" } })
        .then((r) => r.data)
    ),

  // `id` must be a field inside formData - the backend reads it from the body.
  update: (formData) =>
    withAuth(() =>
      api
        .put("/app/", formData, { headers: { ...authHeaders(), "Content-Type": "multipart/form-data" } })
        .then((r) => r.data)
    ),

  remove: (applicationId) =>
    withAuth(() =>
      api.delete("/app/", { data: { applicationId }, headers: authHeaders() }).then((r) => r.data)
    ),

  // Downloads the actual app file. Returns the blob plus the filename the
  // server sent, so the caller can trigger a real browser "save file".
  download: (applicationId) =>
    withAuth(async () => {
      const response = await api.get("/app/download", {
        params: { applicationId },
        headers: authHeaders(),
        responseType: "blob",
      });
      return { blob: response.data, filename: filenameFromHeader(response) };
    }),
};

// -----------------------------------------------------------------------
// Images (screenshots) for an app
// -----------------------------------------------------------------------
export const imagesApi = {
  list: (applicationId) =>
    withAuth(() =>
      api
        .get("/images/", { params: { applicationId }, headers: authHeaders() })
        .then((r) => r.data)
    ),

  upload: (applicationId, file, { isIcon = false } = {}) => {
    const formData = new FormData();
    formData.append("applicationId", applicationId);
    formData.append("image", file);
    if (isIcon) formData.append("isIcon", "true");
    return withAuth(() =>
      api
        .post("/images/", formData, { headers: { ...authHeaders(), "Content-Type": "multipart/form-data" } })
        .then((r) => r.data)
    );
  },

  remove: (applicationId, imageId) =>
    withAuth(() =>
      api
        .delete("/images/", { data: { applicationId, imageId }, headers: authHeaders() })
        .then((r) => r.data)
    ),

  // The image itself is a private, authenticated binary route, so it can't
  // just be used as an <img src="..."> - fetch it as a blob and hand back
  // an object URL the component can put in an <img> tag.
  getObjectUrl: (applicationId, imageId) =>
    withAuth(async () => {
      const response = await api.get("/images/appImage", {
        params: { applicationId, imageId },
        headers: authHeaders(),
        responseType: "blob",
      });
      return URL.createObjectURL(response.data);
    }),
};

// -----------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------
export const categoriesApi = {
  list: () =>
    withAuth(() => api.get("/category/", { headers: authHeaders() }).then((r) => r.data)),

  create: (name) =>
    withAuth(() =>
      api.post("/category/", { name }, { headers: authHeaders() }).then((r) => r.data)
    ),

  remove: (id) =>
    withAuth(() =>
      api.delete("/category/", { data: { id }, headers: authHeaders() }).then((r) => r.data)
    ),
};

// -----------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------
export const adminApi = {
  activity: () =>
    withAuth(() => api.get("/admin/activity", { headers: authHeaders() }).then((r) => r.data)),

  logs: (limit = 100) =>
    withAuth(() =>
      api.get("/admin/logs", { params: { limit }, headers: authHeaders() }).then((r) => r.data)
    ),

  // Either { range: "7d" | "30d" } or a custom { from: "yyyy-mm-dd", to: "yyyy-mm-dd" }.
  exportLogsCsv: (params) =>
    withAuth(async () => {
      const response = await api.get("/admin/logs/export", {
        params,
        headers: authHeaders(),
        responseType: "blob",
      });
      return { blob: response.data, filename: filenameFromHeader(response) || "logs.csv" };
    }),

  // Either { range: "7d" | "30d" } or a custom { from: "yyyy-mm-dd", to: "yyyy-mm-dd" }.
  downloadsHistory: (params) =>
    withAuth(() =>
      api.get("/admin/downloads-history", { params, headers: authHeaders() }).then((r) => r.data)
    ),

  appsByCategory: () =>
    withAuth(() =>
      api.get("/admin/apps-by-category", { headers: authHeaders() }).then((r) => r.data)
    ),

  downloadsByCategory: () =>
    withAuth(() =>
      api.get("/admin/downloads-by-category", { headers: authHeaders() }).then((r) => r.data)
    ),

  // Either { range: "7d" | "30d" } or a custom { from: "yyyy-mm-dd", to: "yyyy-mm-dd" }.
  requestDownloadsExport: (params) =>
    withAuth(() =>
      api
        .post("/admin/export/downloads", params, { headers: authHeaders() })
        .then((r) => r.data)
    ),

  getExportJob: (jobId) =>
    withAuth(() =>
      api.get(`/admin/export/jobs/${jobId}`, { headers: authHeaders() }).then((r) => r.data)
    ),

  downloadExportJob: (jobId) =>
    withAuth(async () => {
      const response = await api.get(`/admin/export/jobs/${jobId}/download`, {
        headers: authHeaders(),
        responseType: "blob",
      });
      return { blob: response.data, filename: filenameFromHeader(response) || `export-${jobId}.csv.gz` };
    }),

  // Streams the CSV immediately instead of going through the job queue -
  // blocks the request until done, so it's only reasonable for small
  // ranges. Either { range: "7d" | "30d" } or a custom { from, to }.
  downloadsExportSync: (params) =>
    withAuth(async () => {
      const response = await api.get("/admin/export/downloads-sync", {
        params,
        headers: authHeaders(),
        responseType: "blob",
      });
      return { blob: response.data, filename: filenameFromHeader(response) || "downloads.csv.gz" };
    }),
};

function filenameFromHeader(response) {
  const header = response.headers?.["content-disposition"];
  if (!header) return undefined;
  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1];
}

// Small helper components use to trigger a real "Save As" download from a blob.
export function saveBlobAsFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
