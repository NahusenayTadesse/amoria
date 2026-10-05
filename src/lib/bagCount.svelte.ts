import { browser } from '$app/environment';

const STORAGE_KEY = 'amoria-bag';
/** Fired by the bag whenever it saves, so a badge on another page follows it. */
export const BAG_CHANGED = 'amoria-bag-changed';

/**
 * How many gifts are in the bag, for the tab bar's badge on any page. It reads what the bag saved
 * in `localStorage` rather than the bag itself, which only exists on the shop page.
 */
class BagCount {
	n = $state(0);
	#started = false;

	read() {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
			this.n = Array.isArray(saved)
				? saved.reduce((sum: number, line) => sum + (Number.isInteger(line?.qty) ? line.qty : 0), 0)
				: 0;
		} catch {
			this.n = 0;
		}
	}

	start() {
		if (!browser || this.#started) return;
		this.#started = true;
		this.read();
		addEventListener('storage', () => this.read());
		addEventListener(BAG_CHANGED, () => this.read());
	}
}

export const bagCount = new BagCount();
