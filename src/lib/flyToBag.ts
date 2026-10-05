/**
 * A little copy of the product jumps from where it was added into the floating bag
 * (`[data-bag-target]`), and the bag gives a bump. Purely decorative: skipped when the user
 * prefers reduced motion, or when there is no bag on screen.
 */
export function flyToBag(source: Element | null | undefined, image?: string | null) {
	if (!source || typeof document === 'undefined') return;
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const target = document.querySelector<HTMLElement>('[data-bag-target]');
	if (!target) return;

	const from = source.getBoundingClientRect();
	const to = target.getBoundingClientRect();
	if (!from.width || !to.width) return;

	const size = 56;
	const startX = from.left + from.width / 2 - size / 2;
	const startY = from.top + from.height / 2 - size / 2;
	const dx = to.left + to.width / 2 - size / 2 - startX;
	const dy = to.top + to.height / 2 - size / 2 - startY;

	const ghost = document.createElement('div');
	ghost.setAttribute('aria-hidden', 'true');
	Object.assign(ghost.style, {
		position: 'fixed',
		zIndex: '1000',
		left: `${startX}px`,
		top: `${startY}px`,
		width: `${size}px`,
		height: `${size}px`,
		borderRadius: '9999px',
		pointerEvents: 'none',
		boxShadow: '0 8px 20px rgb(0 0 0 / 0.3)',
		background: image ? `center / cover url("${image}")` : 'var(--am-ribbon, #b4233c)'
	});
	document.body.append(ghost);

	// Up and over, then down into the bag: two keyframes on the way give it an arc.
	const lift = Math.min(120, Math.abs(dy) / 2 + 40);
	const flight = ghost.animate(
		[
			{ transform: 'translate(0, 0) scale(1)', opacity: 1 },
			{
				transform: `translate(${dx * 0.55}px, ${dy * 0.55 - lift}px) scale(0.8)`,
				opacity: 1,
				offset: 0.55
			},
			{ transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.6 }
		],
		{ duration: 650, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' }
	);
	flight.onfinish = () => {
		ghost.remove();
		target.animate(
			[{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
			{ duration: 300, easing: 'ease-out' }
		);
	};
	flight.oncancel = () => ghost.remove();
}
