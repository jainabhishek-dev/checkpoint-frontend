import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api/auth";
import type { AuthState } from "../types";

export function useAuth() {
  const { data, isLoading, error } = useQuery<AuthState, Error>({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: data?.user ?? null,
    isAdmin: data?.is_admin ?? false,
    isSuperAdmin: data?.is_super_admin ?? false,
    isLoading,
    isAuthenticated: !!data?.user,
    error,
  };
}
