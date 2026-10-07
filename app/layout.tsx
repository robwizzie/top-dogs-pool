import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Instrument_Serif, Inter } from 'next/font/google';
import './globals.css';
import { TEAM_NAME } from '@/lib/config';
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_OG_IMAGE, SITE_TITLE, SITE_URL } from '@/lib/site';

/**
 * The document shell, and nothing else.
 *
 * The site's chrome — header, season banner, footer, mobile tab bar, cart,
 * command palette — lives in `app/(site)/layout.tsx`, not here. Rack Up is a
 * separate app that happens to be served from the same domain, and layouts in
 * the App Router compose rather than replace: anything put here would appear
 * on top of Rack Up's own header too, which is exactly the mixing of the two
 * styles we don't want.
 *
 * Route groups don't affect URLs, so `app/(site)/roster` is still `/roster`.
 */

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

const serif = Instrument_Serif({
	weight: '400',
	style: ['normal', 'italic'],
	subsets: ['latin'],
	variable: '--font-serif',
	display: 'swap'
});

export const metadata: Metadata = {
	// Every relative URL below (og:image, canonical, og:url) resolves against
	// this. Without it, link previews get a relative og:image and show nothing.
	metadataBase: new URL(SITE_URL),
	title: {
		default: SITE_TITLE,
		template: `%s · ${TEAM_NAME}`
	},
	description: SITE_DESCRIPTION,
	applicationName: TEAM_NAME,
	keywords: SITE_KEYWORDS,
	authors: [{ name: TEAM_NAME, url: SITE_URL }],
	creator: TEAM_NAME,
	publisher: TEAM_NAME,
	category: 'sports',
	manifest: '/manifest.webmanifest',
	// The card itself is app/opengraph-image.tsx.
	openGraph: {
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		siteName: SITE_NAME,
		locale: 'en_US',
		type: 'website',
		images: [SITE_OG_IMAGE]
	},
	twitter: {
		card: 'summary_large_image',
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		images: [SITE_OG_IMAGE]
	},
	robots: {
		index: true,
		follow: true,
		googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 }
	},
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
			<body className={`${inter.variable} ${bebas.variable} ${serif.variable}`}>{children}</body>
		</html>
	);
}
