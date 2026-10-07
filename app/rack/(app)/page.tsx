import type { Metadata } from "next";
import { RackHome } from "@/components/rack/RackHome";

export const metadata: Metadata = { alternates: { canonical: "/rack" } };

export default function RackPage() {
  return <RackHome />;
}
