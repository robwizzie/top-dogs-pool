import { RACK_SETUP_HINT } from "@/lib/rack/supabase/env";
import { PageHeader } from "@/components/ui/Section";

/**
 * Shown instead of the section when Supabase isn't configured. The rest of the
 * site builds and deploys without it, so a missing key should read as a setup
 * step rather than a crash.
 */
export function SetupNotice() {
  return (
    <>
      <PageHeader
        eyebrow="Rack Up"
        title="Not connected yet"
        subtitle="This section needs a Supabase project to store live matches."
      />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <p className="text-sm text-[var(--fg-dim)]">{RACK_SETUP_HINT}</p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-[var(--color-cream-dim)]">
{`NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>`}
          </pre>
          <p className="mt-4 text-xs text-[var(--fg-dim)]">
            Then apply the migrations in{" "}
            <code className="text-[var(--color-brass)]">supabase/migrations/</code>{" "}
            — see the Rack Up section of the README.
          </p>
        </div>
      </div>
    </>
  );
}
