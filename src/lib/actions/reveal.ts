/**
 * Lets a block ease in the first time it scrolls into view.
 *
 * Progressive on purpose: the server renders every block visible, and this hides one only once
 * JavaScript is running *and* the block is still below the fold. Above-the-fold blocks are never
 * touched (no flash), reduced-motion visitors get no motion, and a browser without
 * IntersectionObserver keeps the plain page. The transition itself lives in `store.css`.
 */
export function reveal(node: HTMLElement) {
	if (
		typeof IntersectionObserver === 'undefined' ||
		matchMedia('(prefers-reduced-motion: reduce)').matches
	) {
		return;
	}

	const { top, bottom } = node.getBoundingClientRect();
	if (top < innerHeight * 0.92 && bottom > 0) return;

	node.dataset.reveal = 'pending';
	const observer = new IntersectionObserver(
		([entry]) => {
			if (!entry.isIntersecting) return;
			node.dataset.reveal = 'in';
			observer.disconnect();
		},
		{ threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
	);
	observer.observe(node);

	return { destroy: () => observer.disconnect() };
}
