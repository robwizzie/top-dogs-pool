import { RACK_SETUP_HINT } from "@/lib/rack/supabase/env";

/**
 * Shown instead of the section when Supabase isn't configured. The rest of the
 * site builds and deploys without it, so a missing key should read as a setup
 * step rather than a crash.
 *
 * Styled inline rather than with the section's UI kit, because it renders
 * outside <RackShell> — it is what you get when there is no backend to have a
 * session with.
 */
export function SetupNotice() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <div className="rounded-[var(--rack-radius-lg)] border border-[hsl(var(--rack-border))] bg-[hsl(var(--rack-surface))] p-6 shadow-[var(--rack-shadow-md)]">
        <p className="font-[family-name:var(--rack-font-heading)] text-2xl font-bold">
          Not connected yet
        </p>
        <p className="mt-1 text-sm text-[hsl(var(--rack-fg-muted))]">
          {RACK_SETUP_HINT}
        </p>
        <pre className="mt-4 overflow-x-auto rounded-[var(--rack-radius)] bg-[hsl(var(--rack-bg-soft))] p-4 text-xs text-[hsl(var(--rack-fg-muted))]">
{`NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
        </pre>
        <p className="mt-4 text-xs text-[hsl(var(--rack-fg-muted))]">
          Then apply{" "}
          <code className="text-[hsl(var(--rack-primary))]">supabase/migrations/</code>{" "}
          — see the Rack Up section of the README.
        </p>
      </div>
    </div>
  );
}
