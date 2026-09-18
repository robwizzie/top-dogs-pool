import type { ReactNode } from "react";
import { RACK_CONFIGURED } from "@/lib/rack/supabase/env";
import { RackShell } from "@/components/rack/RackShell";
import { SetupNotice } from "@/components/rack/SetupNotice";

/**
 * Rack Up's own chrome: header, nav, theme toggle, footer.
 *
 * The TV display sits outside this group on purpose — it is a scoreboard to
 * point a screen at, not something to navigate, so it gets the theme canvas
 * from the parent layout and nothing else.
 */
export default function RackAppLayout({ children }: { children: ReactNode }) {
  if (!RACK_CONFIGURED) return <SetupNotice />;
  return <RackShell>{children}</RackShell>;
}
