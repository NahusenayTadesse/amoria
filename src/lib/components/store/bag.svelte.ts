import { createContext } from 'svelte';
import { lineTotal, sumBirr } from '$lib/money';

/**
 * The shopper's bag. Lives in the browser — the checkout posts it, and the server re-reads every
 * product and price, so nothing here is trusted (§5.3). Kept in `localStorage` as a convenience:
 * a closed tab or a slow network does not lose the bag, and a blocked or private storage simply
 * starts empty.
 */

export type BagProduct = {
	id: number;
	name: string;
	nameAm: string | null;
	price: number;
	stockQty: number;
};
export type BagLine = { productId: number; qty: number };

const STORAGE_KEY = 'amoria-bag';
/** The server's limits (`orders.ts`), mirrored so the buttons stop where the checkout would. */
export const MAX_LINES = 20;
export const MAX_QTY = 20;

export class Bag {
	lines = $state<BagLine[]>([]);

	#products: () => BagProduct[];

	/** `products` is read lazily so the bag follows the page's data when it changes. */
	constructor(products: () => BagProduct[]) {
		this.#products = products;
	}

	/** Lines whose product is still on sale, with the price the page shows. */
	items = $derived.by(() => {
		const products = this.#products();
		return this.lines.flatMap((line) => {
			const product = products.find((p) => p.id === line.productId);
			if (!product) return [];
			return [{ ...line, product, total: lineTotal(product.price, line.qty) }];
		});
	});

	count = $derived(this.items.reduce((n, item) => n + item.qty, 0));
	total = $derived(sumBirr(this.items.map((item) => item.total)));

	qtyOf(productId: number) {
		return this.lines.find((line) => line.productId === productId)?.qty ?? 0;
	}

	/** Most this product can go to: its stock, and the per-line cap. */
	maxFor(product: BagProduct) {
		return Math.min(product.stockQty, MAX_QTY);
	}

	set(product: BagProduct, qty: number) {
		const next = Math.max(0, Math.min(qty, this.maxFor(product)));
		const index = this.lines.findIndex((line) => line.productId === product.id);

		if (next === 0) {
			if (index >= 0) this.lines.splice(index, 1);
		} else if (index >= 0) {
			this.lines[index].qty = next;
		} else if (this.lines.length < MAX_LINES) {
			this.lines.push({ productId: product.id, qty: next });
		}
		this.save();
	}

	add(product: BagProduct) {
		this.set(product, this.qtyOf(product.id) + 1);
	}

	clear() {
		this.lines = [];
		this.save();
	}

	/** What the checkout posts: only lines still on sale. */
	toJSON() {
		return JSON.stringify(this.items.map(({ productId, qty }) => ({ productId, qty })));
	}

	/** Called once in the browser. Anything unreadable is ignored. */
	restore() {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
			if (Array.isArray(saved)) {
				this.lines = saved
					.filter(
						(line) =>
							Number.isInteger(line?.productId) && Number.isInteger(line?.qty) && line.qty > 0
					)
					.slice(0, MAX_LINES);
			}
		} catch {
			// Blocked storage or a damaged value: start with an empty bag.
		}
	}

	private save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lines));
		} catch {
			// Private mode or full storage: the bag still works for this visit.
		}
	}
}

export const [getBag, setBag] = createContext<Bag>();
