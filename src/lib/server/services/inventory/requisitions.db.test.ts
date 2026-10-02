import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requisition, requisitionLine, stockDocument } from '$lib/server/db/schema';
import {
	actorFor,
	dayFromNow,
	makeProduct,
	makeStaff,
	resetDb,
	stockOf
} from '$lib/server/testing/db';
import { defaultPlace, places } from './ledger';
import { postDocument } from './post';
import {
	cancelRequisition,
	decideRequisition,
	issueFromRequisition,
	saveRequisition,
	submitRequisition
} from './requisitions';

beforeEach(resetDb);

const shopFloor = async () => defaultPlace(await db.transaction((tx) => places(tx))).id;
const reqRow = async (id: number) =>
	(await db.select().from(requisition).where(eq(requisition.id, id)))[0];

async function submitted(
	lines: { productId: number; quantity: number }[],
	by: string | null = null
) {
	const header = {
		purpose: 'decor' as const,
		requester: 'Wedding crew',
		requestDate: dayFromNow(0),
		locationId: await shopFloor()
	};
	const id = await saveRequisition({ header, lines }, actorFor(by));
	await submitRequisition(id, actorFor(by));
	return id;
}

describe('requisitions', () => {
	it('is requested, numbered on submit, approved with cut quantities, issued and closed', async () => {
		const [requester, approver, keeper] = [await makeStaff(), await makeStaff(), await makeStaff()];
		const ribbon = await makeProduct({ stockQty: 20, kind: 'material', name: 'Ribbon' });
		const glue = await makeProduct({ stockQty: 5, kind: 'material', name: 'Glue' });
		const id = await submitted(
			[
				{ productId: ribbon, quantity: 10 },
				{ productId: glue, quantity: 4 }
			],
			requester
		);
		expect((await reqRow(id)).number).toMatch(/^AM-REQ-\d{4}-00001$/);

		const lines = await db
			.select()
			.from(requisitionLine)
			.where(eq(requisitionLine.requisitionId, id));
		const ribbonLine = lines.find((l) => l.productId === ribbon)!;
		await decideRequisition(
			id,
			{ approve: true, quantities: { [ribbonLine.id]: 6 } },
			actorFor(approver)
		);
		expect((await reqRow(id)).status).toBe('approved');

		const issue = await issueFromRequisition(id, actorFor(keeper));
		const [doc] = await db.select().from(stockDocument).where(eq(stockDocument.id, issue));
		expect(doc).toMatchObject({ type: 'issue', party: 'Wedding crew', requisitionId: id });

		await postDocument(issue, actorFor(keeper));
		expect(await stockOf(ribbon)).toBe(14); // 6 of the 10 asked for
		expect(await stockOf(glue)).toBe(1);
		expect((await reqRow(id)).status).toBe('issued');
		await expect(issueFromRequisition(id, actorFor(keeper))).rejects.toThrow(/already been issued/);
	});

	it('will not let someone decide their own requisition, unless allowed', async () => {
		const me = await makeStaff();
		const p = await makeProduct({ stockQty: 5, kind: 'material' });
		const id = await submitted([{ productId: p, quantity: 1 }], me);
		await expect(decideRequisition(id, { approve: true }, actorFor(me))).rejects.toThrow(
			/Someone else/
		);
		await decideRequisition(id, { approve: true, allowOwn: true }, actorFor(me));
		expect((await reqRow(id)).status).toBe('approved');
	});

	it('asks for a reason to reject, and refuses to approve nothing', async () => {
		const other = await makeStaff();
		const p = await makeProduct({ stockQty: 5, kind: 'material' });
		const id = await submitted([{ productId: p, quantity: 2 }]);
		await expect(decideRequisition(id, { approve: false }, actorFor(other))).rejects.toThrow(
			/Say why/
		);
		const [line] = await db
			.select()
			.from(requisitionLine)
			.where(eq(requisitionLine.requisitionId, id));
		await expect(
			decideRequisition(id, { approve: true, quantities: { [line.id]: 0 } }, actorFor(other))
		).rejects.toThrow(/Nothing is approved/);
		await expect(
			decideRequisition(id, { approve: true, quantities: { [line.id]: 3 } }, actorFor(other))
		).rejects.toThrow(/between 0 and 2/);
		await decideRequisition(id, { approve: false, note: 'Not in the budget' }, actorFor(other));
		expect(await reqRow(id)).toMatchObject({
			status: 'rejected',
			decisionNote: 'Not in the budget'
		});
	});

	it('cannot be edited after submitting, and cancels until issued', async () => {
		const p = await makeProduct({ stockQty: 5, kind: 'material' });
		const id = await submitted([{ productId: p, quantity: 1 }]);
		await expect(
			saveRequisition(
				{
					id,
					header: {
						purpose: 'decor',
						requester: 'X',
						requestDate: dayFromNow(0),
						locationId: await shopFloor()
					},
					lines: [{ productId: p, quantity: 2 }]
				},
				actorFor(null)
			)
		).rejects.toThrow(/Only a draft/);
		await cancelRequisition(id, actorFor(null));
		expect((await reqRow(id)).status).toBe('cancelled');
		await expect(cancelRequisition(id, actorFor(null))).rejects.toThrow(/already cancelled/);
	});

	it('will not issue more than the store holds, and leaves the requisition approved', async () => {
		const other = await makeStaff();
		const p = await makeProduct({ stockQty: 2, kind: 'material', name: 'Vase' });
		const id = await submitted([{ productId: p, quantity: 5 }]);
		await decideRequisition(id, { approve: true }, actorFor(other));
		const issue = await issueFromRequisition(id, actorFor(null));
		await expect(postDocument(issue, actorFor(null))).rejects.toThrow(/Only 2 of Vase/);
		expect((await reqRow(id)).status).toBe('approved');
	});
});
