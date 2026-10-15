"use client";

// Finishes every emailed sign-in link: staff invites, password resets and
// email confirmations. Handles both link styles Supabase sends:
//   #access_token=...&refresh_token=...&type=invite|recovery   (any browser)
//   ?code=...                                                  (same browser)
// Tokens are removed from the address bar before anything else happens.

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const code = url.searchParams.get("code");
    const type = hash.get("type") ?? url.searchParams.get("type");
    const error = hash.get("error_description") ?? url.searchParams.get("error_description");
    window.history.replaceState(null, "", "/auth/callback");

    (async () => {
      if (error) return setProblem(error);
      const supabase = createClient();
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      const result =
        accessToken && refreshToken
          ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          : code
            ? await supabase.auth.exchangeCodeForSession(code)
            : { error: { message: "This link is incomplete." } };
      if (result.error) return setProblem(result.error.message);

      // New staff and password resets choose a password first.
      window.location.replace(type === "invite" || type === "recovery" ? "/auth/update-password" : "/dashboard");
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="kd-card w-full max-w-md stack">
        <h1 className="font-display text-2xl">KD Pops</h1>
        {problem ? (
          <>
            <p className="m-0">That link didn&apos;t work: {problem}</p>
            <p className="form-note">
              Links expire after a while and work only once. Ask for a fresh one by resetting your password.
            </p>
            <Link className="pill" href="/auth/forgot-password">
              Get a new link
            </Link>
          </>
        ) : (
          <p className="m-0">Signing you in...</p>
        )}
      </div>
    </main>
  );
}
