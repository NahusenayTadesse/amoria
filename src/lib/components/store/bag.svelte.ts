import { createContext } from 'svelte';
import { lineTotal, sumBirr } from '$lib/money';
import { BAG_CHANGED } from '$lib/bagCount.svelte';
import {
	boxParts,
	boxPickItems,
	bundlePrice,
	checkBox,
	type BoxChoice,
	type BoxOffer,
	type BoxPick
} from '$lib/bundle';

/**
 * The shopper's bag. Lives in the browser — the checkout posts it, and the server re-reads every
 * product and price, so nothing here is trusted (§5.3). Kept in `localStorage` as a convenience:
 * a closed tab or a slow network does not lose the bag, and a blocked or private storage simply
 * starts empty.
 */

export type BagProduct = {
	/** A gift or a bundle; `id` is that table's, `key` is unique across both (`p12`, `b3`). */
	kind: 'product' | 'bundle';
	id: number;
	key: string;
	slug: string;
	name: string;
	nameAm: string | null;
	price: number;
	stockQty: number;
	/** A build-your-own box: what may go in it, priced from its contents. */
	bundle?: { discountPercent: number; custom?: BoxOffer | null } | null;
};

/**
 * A line of the bag. A built box is its own line, keyed by its contents (`c3:12.2,15.1`), with
 * `of` naming the bundle it was built from: two boxes with different gifts are two lines.
 */
export type BagLine = { key: string; qty: number; of?: string; items?: BoxPick[] };

/** A line as the bag shows it: priced, held to its stock, and for a box, what is in it. */
export type BagItem = BagLine & {
	product: BagProduct;
	unitPrice: number;
	total: number;
	max: number;
	picks: (BoxPick & { choice: BoxChoice })[] | null;
};

const STORAGE_KEY = 'amoria-bag';
/** The server's limits (`orders.ts`), mirrored so the buttons stop where the checkout would. */
export const MAX_LINES = 20;
export const MAX_QTY = 20;

/** The offer behind a build-your-own bundle, or null. */
export const boxOffer = (product: BagProduct) => product.bundle?.custom ?? null;

export class Bag {
	lines = $state<BagLine[]>([]);

	#products: () => BagProduct[];

	/** `products` is read lazily so the bag follows the page's data when it changes. */
	constructor(products: () => BagProduct[]) {
		this.#products = products;
	}

	/**
	 * Lines still on sale, with the price the page shows and the most the line may go to. A built
	 * box whose gift is gone, or that no longer fits its container's rules, drops out.
	 */
	items = $derived.by(() => {
		const products = this.#products();
		return this.lines.flatMap((line): BagItem[] => {
			const product = products.find((p) => p.key === (line.of ?? line.key));
			if (!product) return [];
			const offer = boxOffer(product);
			if (!offer) {
				if (line.items) return [];
				const max = this.maxFor(product);
				return [
					{
						...line,
						product,
						unitPrice: product.price,
						total: lineTotal(product.price, line.qty),
						max,
						picks: null
					}
				];
			}
			// A box needs its contents; a bare line for a box (an old link) is not a box.
			if (!line.items?.length) return [];
			const picks = line.items.flatMap((pick) => {
				const choice = offer.choices.find((c) => c.productId === pick.productId);
				return choice ? [{ ...pick, choice }] : [];
			});
			if (picks.length !== line.items.length) return [];
			if (checkBox(offer.rules, boxPickItems(offer, line.items)).length) return [];
			const unitPrice = bundlePrice(boxParts(offer, line.items), product.bundle!.discountPercent);
			const max = Math.min(
				product.stockQty,
				MAX_QTY,
				...picks.map((pick) => Math.floor(pick.choice.stockQty / pick.qty))
			);
			return [{ ...line, product, unitPrice, total: lineTotal(unitPrice, line.qty), max, picks }];
		});
	});

	count = $derived(this.items.reduce((n, item) => n + item.qty, 0));
	total = $derived(sumBirr(this.items.map((item) => item.total)));

	qtyOf(key: string) {
		return this.lines.find((line) => line.key === key)?.qty ?? 0;
	}

	/** Most this product can go to: its stock, and the per-line cap. */
	maxFor(product: BagProduct) {
		return Math.min(product.stockQty, MAX_QTY);
	}

	/** A gift or a staff bundle. A build-your-own box is added with `addBox`. */
	set(product: BagProduct, qty: number) {
		if (boxOffer(product)) return;
		const next = Math.max(0, Math.min(qty, this.maxFor(product)));
		const index = this.lines.findIndex((line) => line.key === product.key);

		if (next === 0) {
			if (index >= 0) this.lines.splice(index, 1);
		} else if (index >= 0) {
			this.lines[index].qty = next;
		} else if (this.lines.length < MAX_LINES) {
			this.lines.push({ key: product.key, qty: next });
		}
		this.save();
	}

	add(product: BagProduct) {
		this.set(product, this.qtyOf(product.key) + 1);
	}

	/** One more box with these gifts in it: the same box again adds to its line. */
	addBox(product: BagProduct, picks: BoxPick[]) {
		const items = picks
			.filter((pick) => pick.qty > 0)
			.map(({ productId, qty }) => ({ productId, qty }))
			.toSorted((a, b) => a.productId - b.productId);
		if (!items.length) return;
		const key = `c${product.id}:${items.map((i) => `${i.productId}.${i.qty}`).join(',')}`;
		const line = this.lines.find((l) => l.key === key);
		if (line) {
			this.setLine(key, line.qty + 1);
			return;
		}
		if (this.lines.length >= MAX_LINES) return;
		this.lines.push({ key, of: product.key, qty: 1, items });
		this.save();
	}

	/** Any line by its key, held to what that line may go to; 0 removes it. */
	setLine(key: string, qty: number) {
		const index = this.lines.findIndex((line) => line.key === key);
		if (index < 0) return;
		const max = this.items.find((item) => item.key === key)?.max ?? 0;
		const next = Math.max(0, Math.min(qty, max));
		if (next === 0) this.lines.splice(index, 1);
		else this.lines[index].qty = next;
		this.save();
	}

	clear() {
		this.lines = [];
		this.save();
	}

	/** What the checkout posts: only lines still on sale, each a gift or a bundle by its id. */
	toJSON() {
		return JSON.stringify(
			this.items.map(({ product, qty, items }) =>
				product.kind === 'bundle'
					? { bundleId: product.id, qty, ...(items ? { items } : {}) }
					: { productId: product.id, qty }
			)
		);
	}

	/** Called once in the browser. Anything unreadable is ignored. */
	restore() {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
			if (Array.isArray(saved)) {
				this.lines = saved
					.flatMap((line): BagLine[] => {
						if (!Number.isInteger(line?.qty) || line.qty <= 0) return [];
						if (typeof line.key === 'string') {
							if (!Array.isArray(line.items)) return [{ key: line.key, qty: line.qty }];
							const items = line.items.filter(
								(item: BoxPick) =>
									Number.isInteger(item?.productId) && Number.isInteger(item?.qty) && item.qty > 0
							);
							return typeof line.of === 'string' && items.length
								? [{ key: line.key, of: line.of, qty: line.qty, items }]
								: [];
						}
						// Saved before bundles: a gift's number alone.
						if (Number.isInteger(line.productId))
							return [{ key: `p${line.productId}`, qty: line.qty }];
						return [];
					})
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
		dispatchEvent(new Event(BAG_CHANGED));
	}
}

export const [getBag, setBag] = createContext<Bag>();
