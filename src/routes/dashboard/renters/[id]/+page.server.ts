import { error, type RequestEvent } from '@sveltejs/kit';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '$lib/server/db';
import {
	category,
	renter,
	renterBankAccount,
	renterListing,
	renterOrder,
	user
} from '$lib/server/db/schema';
import { reviewRenter, setRenterFlags, type RenterDecision } from '$lib/server/services/renters';
import { actorOf } from '$lib/server/paymentAdmin';
import { attempt, formAttempt } from '$lib/server/attempt';
import { reviewNoteSchema } from '$lib/schemas/renters';

/**
 * One renter, for staff: who they are, the papers to check, their accounts and rentals, and the
 * decisions (approve, turn down, suspend, reinstate, trust to post without review, feature).
 */
function renterId(params: { id?: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Renter not found');
	return id;
}

export const load = async ({ params }) => {
	const id = renterId(params);
	const [row] = await db
		.select({ renter, ownerName: user.name, email: user.email })
		.from(renter)
		.innerJoin(user, eq(user.id, renter.userId))
		.where(eq(renter.id, id));
	if (!row) error(404, 'Renter not found');

	const [reviewer, accounts, listings, orders] = await Promise.all([
		row.renter.reviewedBy
			? db.select({ name: user.name }).from(user).where(eq(user.id, row.renter.reviewedBy))
			: [],
		db
			.select({
				id: renterBankAccount.id,
				bankName: renterBankAccount.bankName,
				accountName: renterBankAccount.accountName,
				accountNumber: renterBankAccount.accountNumber,
				status: renterBankAccount.status
			})
			.from(renterBankAccount)
			.where(and(eq(renterBankAccount.renterId, id), notDeleted(renterBankAccount)))
			.orderBy(asc(renterBankAccount.sortOrder)),
		db
			.select({
				id: renterListing.id,
				name: renterListing.name,
				categoryName: category.name,
				pricing: renterListing.pricing,
				price: renterListing.price,
				priceUnit: renterListing.priceUnit,
				status: renterListing.status
			})
			.from(renterListing)
			.innerJoin(category, eq(category.id, renterListing.categoryId))
			.where(and(eq(renterListing.renterId, id), notDeleted(renterListing)))
			.orderBy(desc(renterListing.updatedAt)),
		db
			.select({ status: renterOrder.status, n: count() })
			.from(renterOrder)
			.where(eq(renterOrder.renterId, id))
			.groupBy(renterOrder.status)
	]);

	return {
		renter: row.renter,
		owner: { name: row.ownerName, email: row.email },
		reviewerName: reviewer[0]?.name ?? null,
		accounts,
		listings,
		orders: Object.fromEntries(orders.map((o) => [o.status, Number(o.n)])),
		noteForm: await superValidate(zod4(reviewNoteSchema))
	};
};

const decide =
	(decision: RenterDecision, done: string) => async (event: RequestEvent<{ id: string }>) => {
		requirePermission(event.locals, 'renters.manage');
		const id = renterId(event.params);
		if (decision === 'approve' || decision === 'reinstate') {
			return attempt(() => reviewRenter(actorOf(event), id, decision, null), done);
		}
		const form = await superValidate(event.request, zod4(reviewNoteSchema));
		return formAttempt(
			form,
			() => reviewRenter(actorOf(event), id, decision, form.data.note),
			done
		);
	};

export const actions = {
	approve: decide('approve', 'Approved: they can list rentals now.'),
	reject: decide('reject', 'Turned down. They see your reason and can send their papers again.'),
	suspend: decide('suspend', 'Suspended: their page and rentals are hidden.'),
	reinstate: decide('reinstate', 'Reinstated.'),

	trust: async (event) => {
		requirePermission(event.locals, 'renters.manage');
		const on = (await event.request.formData()).get('on') === '1';
		return attempt(
			() => setRenterFlags(actorOf(event), renterId(event.params), { autoPublish: on }),
			on ? 'They can post without review now.' : 'Their posts are reviewed again.'
		);
	},

	feature: async (event) => {
		requirePermission(event.locals, 'renters.manage');
		const on = (await event.request.formData()).get('on') === '1';
		return attempt(
			() => setRenterFlags(actorOf(event), renterId(event.params), { isFeatured: on }),
			on ? 'Featured on the marketplace.' : 'No longer featured.'
		);
	}
};
