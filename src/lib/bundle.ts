import { lineTotal, roundBirr, sumBirr } from '$lib/money';

/**
 * A bundle's price and stock, read off its contents (§5.2). No server imports: the dashboard
 * and the shop show these figures, and checkout charges them, from the same functions.
 */

/** The most a bundle may take off its contents' prices, in percent. */
export const MAX_BUNDLE_DISCOUNT = 90;

/** One gift in a bundle: how many of it, its current price and what is in stock. */
export type BundlePart = { qty: number; price: number; stockQty: number };

/** What the contents cost bought one by one. */
export function bundleFullPrice(parts: BundlePart[]): number {
	return sumBirr(parts.map((part) => lineTotal(part.price, part.qty)));
}

/** The bundle's price: the full price less the discount, to the cent. */
export function bundlePrice(parts: BundlePart[], discountPercent: number): number {
	const percent = Math.min(Math.max(discountPercent, 0), MAX_BUNDLE_DISCOUNT);
	return roundBirr((bundleFullPrice(parts) * (100 - percent)) / 100);
}

/** How many whole bundles the stock makes: the scarcest gift decides. None without contents. */
export function bundleStock(parts: BundlePart[]): number {
	if (!parts.length) return 0;
	return Math.max(0, Math.min(...parts.map((part) => Math.floor(part.stockQty / part.qty))));
}

/**
 * Splits one bundle's price over its parts in proportion to their full prices, in whole cents
 * that add up to the price exactly; the last part takes the odd cents. Each order row then
 * carries its gift's share, so sales by gift still add up to what was paid.
 */
export function splitBundlePrice(parts: BundlePart[], price: number): number[] {
	const totalCents = Math.round(price * 100);
	const fullCents = parts.map((part) => Math.round(part.price * 100) * part.qty);
	const fullTotal = fullCents.reduce((a, b) => a + b, 0);
	const shares = fullCents.map((cents) =>
		fullTotal === 0 ? 0 : Math.floor((totalCents * cents) / fullTotal)
	);
	if (shares.length) {
		shares[shares.length - 1] += totalCents - shares.reduce((a, b) => a + b, 0);
	}
	return shares.map((cents) => cents / 100);
}

/**
 * A container's rule (`container_rule`): how many gifts of a category, or of one gift, fit in
 * it. `name` is the category's or the gift's, for messages ("at most 50 Flowers").
 */
export type BoxRule = {
	id: number;
	categoryId: number | null;
	productId: number | null;
	minQty: number;
	maxQty: number;
	name: string;
	nameAm: string | null;
};

/** A gift going into a container: its category with every parent above it, and how many. */
export type BoxItem = { productId: number; categoryIds: number[]; qty: number };

export type BoxProblem =
	| { kind: 'not_allowed'; productId: number }
	| { kind: 'too_many'; rule: BoxRule; count: number }
	| { kind: 'too_few'; rule: BoxRule; count: number };

/** The rules a gift counts towards: its own, and its category's (or a parent's). */
export function rulesFor(rules: BoxRule[], item: Pick<BoxItem, 'productId' | 'categoryIds'>) {
	return rules.filter(
		(rule) =>
			rule.productId === item.productId ||
			(rule.categoryId !== null && item.categoryIds.includes(rule.categoryId))
	);
}

/** How many gifts count towards each rule, by rule id. */
export function boxCounts(rules: BoxRule[], items: BoxItem[]): Map<number, number> {
	const counts = new Map(rules.map((rule) => [rule.id, 0]));
	for (const item of items) {
		for (const rule of rulesFor(rules, item)) {
			counts.set(rule.id, (counts.get(rule.id) ?? 0) + item.qty);
		}
	}
	return counts;
}

/**
 * Everything wrong with what is in a container: a gift no rule lets in, a rule gone over, a rule
 * not yet met. Empty means it may be sold. The same check runs in the shop's builder, on the
 * dashboard and at checkout, where it is the one that counts.
 */
export function checkBox(rules: BoxRule[], items: BoxItem[]): BoxProblem[] {
	const problems: BoxProblem[] = [];
	for (const item of items) {
		if (item.qty > 0 && !rulesFor(rules, item).length) {
			problems.push({ kind: 'not_allowed', productId: item.productId });
		}
	}
	const counts = boxCounts(rules, items);
	for (const rule of rules) {
		const count = counts.get(rule.id) ?? 0;
		if (count > rule.maxQty) problems.push({ kind: 'too_many', rule, count });
		else if (count < rule.minQty) problems.push({ kind: 'too_few', rule, count });
	}
	return problems;
}

/** Whether one more of this gift fits: it is let in, and no rule it counts towards is full. */
export function roomForOne(
	rules: BoxRule[],
	items: BoxItem[],
	item: Pick<BoxItem, 'productId' | 'categoryIds'>
): boolean {
	const own = rulesFor(rules, item);
	if (!own.length) return false;
	const counts = boxCounts(rules, items);
	return own.every((rule) => (counts.get(rule.id) ?? 0) < rule.maxQty);
}

/** A gift the customer may put in a container, as the shop's builder shows it. */
export type BoxChoice = {
	productId: number;
	name: string;
	nameAm: string | null;
	price: number;
	stockQty: number;
	image: string | null;
	categoryIds: number[];
};

/** A build-your-own bundle on the shop: the container, its rules, and what can go in it. */
export type BoxOffer = {
	container: { productId: number; name: string; nameAm: string | null; price: number };
	rules: BoxRule[];
	choices: BoxChoice[];
};

/** What the customer chose: a gift and how many. */
export type BoxPick = { productId: number; qty: number };

/** The parts of a built box, container first, priced from the offer. Unknown gifts are dropped. */
export function boxParts(offer: BoxOffer, picks: BoxPick[]): BundlePart[] {
	return [
		{ qty: 1, price: offer.container.price, stockQty: 1 },
		...picks.flatMap((pick) => {
			const choice = offer.choices.find((c) => c.productId === pick.productId);
			return choice && pick.qty > 0
				? [{ qty: pick.qty, price: choice.price, stockQty: choice.stockQty }]
				: [];
		})
	];
}

/** The picks as the rules see them. */
export function boxPickItems(offer: BoxOffer, picks: BoxPick[]): BoxItem[] {
	return picks.flatMap((pick) => {
		const choice = offer.choices.find((c) => c.productId === pick.productId);
		return choice && pick.qty > 0
			? [{ productId: pick.productId, qty: pick.qty, categoryIds: choice.categoryIds }]
			: [];
	});
}

/**
 * The least a box can cost: the container, plus the cheapest gifts that meet every minimum.
 * Shown on the shop as "From ETB …".
 */
export function boxFromPrice(offer: BoxOffer, discountPercent: number): number {
	const picks: BoxPick[] = [];
	for (const rule of offer.rules) {
		const have = boxCounts(offer.rules, boxPickItems(offer, picks)).get(rule.id) ?? 0;
		if (have >= rule.minQty) continue;
		const cheapest = offer.choices
			.filter((c) => c.stockQty > 0 && rulesFor([rule], c).length)
			.toSorted((a, b) => a.price - b.price)[0];
		if (cheapest) picks.push({ productId: cheapest.productId, qty: rule.minQty - have });
	}
	return bundlePrice(boxParts(offer, picks), discountPercent);
}

type OrderRow = {
	id: number;
	qty: number;
	lineTotal: number;
	bundleId: number | null;
	bundleName: string | null;
	bundleQty: number | null;
	/** Set on rows stored since boxes were built by customers; older rows group by bundle. */
	bundleLine?: number | null;
};

/**
 * An order's rows as the customer chose them: a gift on its own, or a bundle with the gifts in
 * it underneath. A bundle's rows are stored one per gift (`order_item.bundleId`); this puts them
 * back together, in the order the first of each was stored.
 */
export function groupOrderItems<T extends OrderRow>(rows: T[]) {
	const lines: (
		| { kind: 'item'; key: string; item: T }
		| {
				kind: 'bundle';
				key: string;
				bundleId: number;
				name: string;
				qty: number;
				lineTotal: number;
				parts: T[];
		  }
	)[] = [];
	for (const row of rows) {
		if (row.bundleId === null) {
			lines.push({ kind: 'item', key: `i${row.id}`, item: row });
			continue;
		}
		const key = row.bundleLine ? `l${row.bundleLine}` : `b${row.bundleId}`;
		const line = lines.find((l) => l.key === key);
		if (line?.kind === 'bundle') {
			line.parts.push(row);
			line.lineTotal = sumBirr([line.lineTotal, row.lineTotal]);
		} else {
			lines.push({
				kind: 'bundle',
				key,
				bundleId: row.bundleId,
				name: row.bundleName ?? '',
				qty: row.bundleQty ?? 1,
				lineTotal: row.lineTotal,
				parts: [row]
			});
		}
	}
	return lines;
}
