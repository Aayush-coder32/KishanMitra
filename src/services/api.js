import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: { "X-Requested-With": "e-kharid" },
});
let refresh;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 401 &&
      !config._retry &&
      !config.url.includes("/auth/")
    ) {
      config._retry = true;
      try {
        refresh ||= api.post("/auth/refresh").finally(() => {
          refresh = null;
        });
        await refresh;
        return api(config);
      } catch {
        window.dispatchEvent(new Event("session-expired"));
      }
    }
    return Promise.reject(error);
  },
);
export const errorMessage = (e) =>
  e.response?.data?.message ||
  "Unable to connect. Please check your connection and try again.";
