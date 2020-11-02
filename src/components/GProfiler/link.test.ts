import { createFeatureQuery } from './link';

describe('Create a query', () => {
    it('Creates a query', () => {
        const v = createFeatureQuery(
            [0, 1, 2, 5],
            [{ gene: 'test1' }, { gene: 'test2' }]
        );

        expect(v).toEqual(`>Top_0

>Top_1
test1
>Top_2
test1
test2
>Top_5
test1
test2
`);
    });
});
