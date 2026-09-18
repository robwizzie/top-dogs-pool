import type { Metadata } from "next";
import { Lilita_One, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import "./rack.css";
import { RACK_NAME, RACK_TAGLINE, RACK_THEME_STORAGE_KEY } from "@/lib/rack/config";

// The original's display face. Loaded only for this section, so the rest of
// the site doesn't pay for it.
const lilita = Lilita_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-rack-display",
  display: "swap",
});
const poppins = Poppins({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-rack-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: RACK_NAME, template: `%s · ${RACK_NAME}` },
  description: `${RACK_NAME} — ${RACK_TAGLINE}. Score APA matches live from your phone, run a bracket, track practice, and put the scoreboard on the TV.`,
};

/**
 * Sets the saved theme before first paint, so someone who chose light doesn't
 * get a flash of dark (or the reverse). It runs inline as the HTML streams,
 * which is why it sits immediately inside the element it targets rather than
 * in a component that would only run after hydration.
 */
const themeBootstrap = `
(function(){
  try {
    var t = localStorage.getItem(${JSON.stringify(RACK_THEME_STORAGE_KEY)});
    if (t === 'light' || t === 'dark') {
      document.currentScript.parentElement.setAttribute('data-rack-theme', t);
    }
  } catch (e) {}
})();
`;

export default function RackLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-rack
      className={`rack-canvas ${lilita.variable} ${poppins.variable} min-h-dvh`}
    >
      <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      {children}
    </div>
  );
}
