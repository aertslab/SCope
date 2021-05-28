import 'jest';

import { zipLists } from './util';

describe('zip arbitrary lists', () => {
    it('zips the empty list', () => {
        expect(zipLists([])).toEqual([]);
    });

    it('zips singleton lists', () => {
        expect(zipLists([[1], [2], [3]])).toEqual([[1, 2, 3]]);

        expect(zipLists([[1]])).toEqual([[1]]);

        expect(zipLists([[1, 2, 3]])).toEqual([[1, 2, 3]]);
    });

    it('zips a pair of lists', () => {
        expect(
            zipLists([
                [1, 2],
                [3, 4],
            ])
        ).toEqual([
            [1, 3],
            [2, 4],
        ]);
    });

    it('zips 3 lists', () => {
        expect(
            zipLists([
                [1, 2],
                [3, 4],
                [5, 6],
            ])
        ).toEqual([
            [1, 3, 5],
            [2, 4, 6],
        ]);
    });

    it('zips 4 lists', () => {
        expect(
            zipLists<number | string>([
                ['a', 'b', 'c', 'd', 'e'],
                [1, 2, 3, 4, 5],
                [0.1, 0.2, 0.3, 0.4, 0.5],
                ['z', 'y', 'x', 'w', 'v'],
            ])
        ).toEqual([
            ['a', 1, 0.1, 'z'],
            ['b', 2, 0.2, 'y'],
            ['c', 3, 0.3, 'x'],
            ['d', 4, 0.4, 'w'],
            ['e', 5, 0.5, 'v'],
        ]);
    });
});
