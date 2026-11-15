import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 10000,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

export function getApiErrorMessage(error) {
  return (
    error.response?.data?.error?.message ??
    (error.request
      ? "The server could not be reached. Check your connection and try again."
      : "The request could not be completed.")
  );
}
