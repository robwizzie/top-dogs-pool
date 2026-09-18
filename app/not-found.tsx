import { CartProvider } from '@/components/store/CartProvider';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import NotFoundContent from './(site)/not-found';

/**
 * The global 404, for URLs that match no route at all.
 *
 * Next.js only renders `app/not-found.tsx` for those, and it renders inside the
 * root layout — which no longer carries the site chrome, since Rack Up shares
 * that root. So this brings the header and footer with it, and reuses the same
 * content as the in-site 404.
 *
 * CartProvider comes along because the header's cart button needs it; without
 * it this page throws during prerender.
 */
export default function NotFound() {
	return (
		<CartProvider>
			<SiteHeader />
			<main className='pb-20 md:pb-0'>
				<NotFoundContent />
			</main>
			<SiteFooter />
		</CartProvider>
	);
}
