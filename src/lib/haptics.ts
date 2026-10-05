/** A short tick on a tap that changes something, where the device supports it (Android browsers). */
export function buzz(ms = 10) {
	try {
		navigator.vibrate?.(ms);
	} catch {
		// Not allowed, or not supported: no tick.
	}
}
