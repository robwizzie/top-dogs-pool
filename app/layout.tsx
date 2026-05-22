import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SeasonBanner } from '@/components/layout/SeasonBanner';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SessionScopeMemory } from '@/components/layout/SessionScopeMemory';
import { CommandPaletteShell } from '@/components/ui/CommandPaletteShell';
import { Toaster } from '@/components/ui/Toaster';
import { CartProvider } from '@/components/store/CartProvider';
import { CartDrawer } from '@/components/store/CartDrawer';
import { TEAM_NAME, TEAM_TAGLINE } from '@/lib/config';

const inter = Inter({
	subsets: ['latin'],
	variable: '--font-sans',
	display: 'swap'
});
const bebas = Bebas_Neue({
	weight: '400',
	subsets: ['latin'],
	variable: '--font-display',
	display: 'swap'
});

export const metadata: Metadata = {
	title: {
		default: `${TEAM_NAME} — APA Pool`,
		template: `%s · ${TEAM_NAME}`
	},
	description: `${TEAM_NAME} — ${TEAM_TAGLINE}. Roster, schedule, stats, sweeps leaderboard, and match clips, all live.`,
	applicationName: TEAM_NAME,
	manifest: '/manifest.webmanifest',
	openGraph: {
		title: `${TEAM_NAME} — APA Pool`,
		description: `${TEAM_NAME} — ${TEAM_TAGLINE}.`,
		type: 'website'
	},
	twitter: { card: 'summary_large_image' },
	icons: {
		icon: [
			{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
			{ url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
			{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
		],
		apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
		shortcut: '/icons/favicon-32.png'
	},
	appleWebApp: {
		capable: true,
		title: TEAM_NAME,
		statusBarStyle: 'black-translucent'
	},
	formatDetection: {
		telephone: false
	}
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	maximumScale: 5,
	viewportFit: 'cover',
	themeColor: [
		{ media: '(prefers-color-scheme: dark)', color: '#0b3326' },
		{ media: '(prefers-color-scheme: light)', color: '#0b3326' }
	]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en' data-theme='dark'>
			<body className={`${inter.variable} ${bebas.variable}`}>
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
			</body>
		</html>
	);
}
