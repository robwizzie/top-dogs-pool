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
	openGraph: {
		title: `${TEAM_NAME} — APA Pool`,
		description: `${TEAM_NAME} — ${TEAM_TAGLINE}.`,
		type: 'website'
	},
	twitter: { card: 'summary_large_image' },
	icons: {
		icon: '/logo.png'
	}
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	themeColor: '#070707'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en' data-theme='dark'>
			<body className={`${inter.variable} ${bebas.variable}`}>
				<Suspense fallback={null}>
					<SessionScopeMemory />
				</Suspense>
				<SiteHeader />
				<SeasonBanner />
				<main className='pb-20 md:pb-0'>{children}</main>
				<SiteFooter />
				<MobileTabBar />
				<Suspense fallback={null}>
					<CommandPaletteShell />
				</Suspense>
			</body>
		</html>
	);
}
