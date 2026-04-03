"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function AuthProvider({ children }) {
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const payload = await response.json();

        if (!mounted) {
          return;
        }

        if (response.ok && payload?.success && payload?.data?.user) {
          setUser(payload.data.user);
        } else {
          clearUser();
        }
      } catch {
        if (mounted) {
          clearUser();
        }
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, [setUser, clearUser]);

  return children;
}
