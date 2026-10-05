import { describe, expect, it } from 'vitest';
import { parseCart } from './share';

describe('parseCart', () => {
	it('reads slug.qty pairs', () => {
		expect(parseCart('red-rose.2,gold-box.1')).toEqual([
			{ slug: 'red-rose', qty: 2 },
			{ slug: 'gold-box', qty: 1 }
		]);
	});

	it('drops anything malformed', () => {
		expect(parseCart('red-rose.0,.3,nodot,box.x,ok.4')).toEqual([{ slug: 'ok', qty: 4 }]);
	});
});
