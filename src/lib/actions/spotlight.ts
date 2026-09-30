/** Tells a `.spotlight` card where the pointer is, so its light can follow. Style: `store.css`. */
export function spotlight(node: HTMLElement) {
	const move = (event: PointerEvent) => {
		const box = node.getBoundingClientRect();
		node.style.setProperty('--px', `${event.clientX - box.left}px`);
		node.style.setProperty('--py', `${event.clientY - box.top}px`);
	};
	node.addEventListener('pointermove', move, { passive: true });
	return { destroy: () => node.removeEventListener('pointermove', move) };
}
