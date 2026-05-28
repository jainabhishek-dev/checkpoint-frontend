import client from "./client";
import type { AuthState } from "../types";

export async function getMe(): Promise<AuthState> {
  const { data } = await client.get<AuthState>("/api/auth/me");
  return data;
}

export function getLoginUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  return `${base}/login/google`;
}

export function getLogoutUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  return `${base}/logout`;
}
