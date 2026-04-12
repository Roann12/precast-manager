import axios, { type InternalAxiosRequestConfig } from "axios";
import { notifyUnauthorized } from "./unauthorized";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

function isPasswordGrantTokenRequest(config: InternalAxiosRequestConfig): boolean {
  const method = (config.method ?? "get").toLowerCase();
  if (method !== "post") return false;
  const path = (config.url ?? "").split("?")[0].replace(/\/+$/, "") || "";
  return path.endsWith("/auth/token");
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const cfg = axios.isAxiosError(error) ? error.config : undefined;
    if (
      status === 401 &&
      cfg &&
      !cfg.skipUnauthorizedRedirect &&
      !isPasswordGrantTokenRequest(cfg)
    ) {
      let msg: string | undefined;
      if (axios.isAxiosError(error)) {
        const d = error.response?.data;
        if (typeof d === "object" && d !== null && "detail" in d) {
          const detail = (d as { detail?: unknown }).detail;
          if (typeof detail === "string" && detail.trim()) msg = detail;
        }
      }
      notifyUnauthorized(msg);
    }
    return Promise.reject(error);
  }
);

export default api;

