import type { AuthErrorCode } from "@tftvn/core";
import axios, { type InternalAxiosRequestConfig, isAxiosError } from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 10_000,
});

const NO_REFRESH = new Set(["/auth/refresh", "/auth/login", "/auth/register", "/auth/logout"]);

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= api
    .post("/auth/refresh")
    .then(
      () => true,
      () => false,
    )
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) {
    throw error;
  }
  const config = error.config as InternalAxiosRequestConfig & { retried?: boolean };
  if (config.retried || NO_REFRESH.has(config.url ?? "")) {
    throw error;
  }
  config.retried = true;
  if (await refreshSession()) {
    return api(config);
  }
  throw error;
});

export interface ApiFailure<Code extends string = AuthErrorCode> {
  code: Code | "unknown";
  fields: Partial<Record<string, Code>>;
}

export function toApiFailure<Code extends string = AuthErrorCode>(
  error: unknown,
): ApiFailure<Code> {
  const data = isAxiosError(error)
    ? (error.response?.data as Partial<ApiFailure<Code>> | undefined)
    : undefined;
  return { code: data?.code ?? "unknown", fields: data?.fields ?? {} };
}
