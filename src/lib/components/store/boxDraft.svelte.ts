import {
	boxCounts,
	boxParts,
	boxPickItems,
	bundleFullPrice,
	bundlePrice,
	checkBox,
	roomForOne,
	type BoxChoice,
	type BoxOffer,
	type BoxPick,
	type BoxRule
} from '$lib/bundle';

/**
 * A box being filled in the shop's builder: what is in it so far, what each rule has counted,
 * what is still wrong, and the price. The buttons stop where the container's rules and the stock
 * do; the checkout checks the same rules again on the server.
 */
export class BoxDraft {
	picks = $state<BoxPick[]>([]);

	#offer: () => BoxOffer;
	#discount: () => number;

	/** Read lazily, so the draft follows the page's data. */
	constructor(offer: () => BoxOffer, discountPercent: () => number) {
		this.#offer = offer;
		this.#discount = discountPercent;
	}

	get offer() {
		return this.#offer();
	}

	items = $derived.by(() => boxPickItems(this.#offer(), this.picks));
	counts = $derived.by(() => boxCounts(this.#offer().rules, this.items));
	problems = $derived.by(() => checkBox(this.#offer().rules, this.items));
	price = $derived.by(() => bundlePrice(boxParts(this.#offer(), this.picks), this.#discount()));
	fullPrice = $derived.by(() => bundleFullPrice(boxParts(this.#offer(), this.picks)));
	count = $derived(this.picks.reduce((n, pick) => n + pick.qty, 0));
	/** Something in it, and every rule met. */
	ready = $derived(this.count > 0 && this.problems.length === 0);

	/** Each rule with the gifts listed under it: a gift goes under its own rule if it has one. */
	sections = $derived.by(() => {
		const { rules, choices } = this.#offer();
		const home = (choice: BoxChoice): BoxRule | undefined =>
			rules.find((rule) => rule.productId === choice.productId) ??
			rules.find(
				(rule) => rule.categoryId !== null && choice.categoryIds.includes(rule.categoryId)
			);
		return rules
			.map((rule) => ({ rule, choices: choices.filter((choice) => home(choice) === rule) }))
			.filter((section) => section.choices.length || section.rule.minQty > 0);
	});

	qtyOf(productId: number) {
		return this.picks.find((pick) => pick.productId === productId)?.qty ?? 0;
	}

	/** In stock beyond what is in the box, and room under every rule it counts towards. */
	canAdd(choice: BoxChoice) {
		return (
			this.qtyOf(choice.productId) < choice.stockQty &&
			roomForOne(this.#offer().rules, this.items, choice)
		);
	}

	add(choice: BoxChoice) {
		if (!this.canAdd(choice)) return;
		const pick = this.picks.find((p) => p.productId === choice.productId);
		if (pick) pick.qty++;
		else this.picks.push({ productId: choice.productId, qty: 1 });
	}

	remove(choice: BoxChoice) {
		const index = this.picks.findIndex((p) => p.productId === choice.productId);
		if (index < 0) return;
		if (this.picks[index].qty > 1) this.picks[index].qty--;
		else this.picks.splice(index, 1);
	}

	reset() {
		this.picks = [];
	}
}
