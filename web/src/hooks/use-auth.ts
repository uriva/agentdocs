"use client";

import db from "@/lib/db";

/**
 * Thin wrapper around InstantDB's useAuth.
 * Returns { isLoading, user, error } plus auth actions.
 */
export function useAuth() {
  const { isLoading, user, error } = db.useAuth();

  return {
    isLoading,
    user: user ?? null,
    error: error ?? null,
    sendMagicCode: (email: string) => db.auth.sendMagicCode({ email }),
    signInWithMagicCode: (email: string, code: string) =>
      db.auth.signInWithMagicCode({ email, code }),
    signOut: () => db.auth.signOut(),
  };
}
