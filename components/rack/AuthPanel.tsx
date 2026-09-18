"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import { Button, Card, ErrorNote, Field, Input } from "./ui";

type Mode = "sign-in" | "sign-up";

/**
 * Sign in / sign up for the section.
 *
 * Deliberately minimal: email and password, one toggle. The old app's auth
 * screen was 471 lines because it hand-rolled validation, a display-name step,
 * a skill-level step and three toast variants into the same form; the skill
 * level now lives on the profile page, where it can be changed later without
 * a second account.
 */
export function AuthPanel({ onSignedIn }: { onSignedIn?: () => void }) {
  const supabase = getSupabaseBrowser();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "sign-up") {
        if (name.trim().length < 2) {
          setError("Add the name you want on the scoreboard.");
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (signUpError) throw signUpError;

        // Projects with email confirmation on return a user but no session.
        if (!data.session) {
          setNotice("Check your email to confirm the account, then sign in.");
          return;
        }
        onSignedIn?.();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <h2 className="font-[family-name:var(--rack-font-display)] text-2xl tracking-wide">
        {mode === "sign-in" ? "Sign in to score" : "Create an account"}
      </h2>
      <p className="mt-1 text-sm text-[hsl(var(--rack-fg-muted))]">
        {mode === "sign-in"
          ? "You only need an account to score or join a table. Anyone can watch."
          : "You can set your skill levels and link your APA number afterwards."}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === "sign-up" && (
          <Field label="Display name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="How you appear on the scoreboard"
              required
            />
          </Field>
        )}

        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </Field>

        <ErrorNote>{error}</ErrorNote>
        {notice && (
          <p className="rounded-lg border border-[hsl(var(--rack-border-strong))] bg-[hsl(var(--rack-accent))]/10 px-3 py-2 text-sm text-[hsl(var(--rack-accent))]">
            {notice}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError(null);
          setNotice(null);
        }}
        className="mt-4 w-full text-center text-sm text-[hsl(var(--rack-fg-muted))] underline underline-offset-4 hover:text-[hsl(var(--rack-fg))]"
      >
        {mode === "sign-in"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </Card>
  );
}
