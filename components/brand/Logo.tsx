import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Logo({ size = 48, className, priority = false }: { size?: number; className?: string; priority?: boolean }) {
	return (
		<span className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
			<Image src='/logo.png' alt='Top Dawgs' fill priority={priority} sizes={`${size}px`} style={{ objectFit: 'contain' }} />
		</span>
	);
}

export function LogoMark({ className, withText = true, priority = false }: { className?: string; withText?: boolean; priority?: boolean }) {
	return (
		<span className={cn('inline-flex items-center gap-3', className)}>
			<Logo size={40} priority={priority} className='hover-roll' />
			{withText && (
				<span className='leading-none'>
					<span className='block font-[family-name:var(--font-display)] text-xl tracking-[0.18em] text-[var(--color-cream)]'>TOP DAWGS</span>
					<span className='block whitespace-nowrap text-[10px] max-[420px]:hidden tracking-[0.18em] text-[var(--color-brass)] sm:tracking-[0.32em]'>APA POOL · SOUTH JERSEY</span>
				</span>
			)}
		</span>
	);
}
