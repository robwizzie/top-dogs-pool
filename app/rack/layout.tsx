import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RACK_CONFIGURED } from "@/lib/rack/supabase/env";
import { RACK_NAME, RACK_TAGLINE } from "@/lib/rack/config";
import { RackShell } from "@/components/rack/RackShell";
import { SetupNotice } from "@/components/rack/SetupNotice";

export const metadata: Metadata = {
  title: RACK_NAME,
  description: `${RACK_NAME} — ${RACK_TAGLINE}. Score APA matches live, run a tournament bracket, track practice drills, and put it all on the TV.`,
};

export default function RackLayout({ children }: { children: ReactNode }) {
  if (!RACK_CONFIGURED) return <SetupNotice />;
  return <RackShell>{children}</RackShell>;
}
