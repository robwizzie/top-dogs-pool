import { Suspense } from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SeasonBanner } from '@/components/layout/SeasonBanner';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SessionScopeMemory } from '@/components/layout/SessionScopeMemory';
import { CommandPaletteShell } from '@/components/ui/CommandPaletteShell';
import { Toaster } from '@/components/ui/Toaster';
import { CartProvider } from '@/components/store/CartProvider';
import { CartDrawer } from '@/components/store/CartDrawer';

/**
 * The Poolmaxxing / Top Dawgs site chrome.
 *
 * Everything under this group gets the felt-and-brass header, season banner,
 * mobile tab bar, footer, cart and command palette. `/rack` deliberately sits
 * outside it — Rack Up brings its own header and its own palette, and stacking
 * the two would put two navbars and two design languages on one screen.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
	return (
		<CartProvider>
			<Suspense fallback={null}>
				<SessionScopeMemory />
			</Suspense>
			<SiteHeader />
			<SeasonBanner />
			<main className='pb-20 md:pb-0'>{children}</main>
			<SiteFooter />
			<MobileTabBar />
			<CartDrawer />
			<Suspense fallback={null}>
				<CommandPaletteShell />
			</Suspense>
			<Toaster />
		</CartProvider>
	);
}
