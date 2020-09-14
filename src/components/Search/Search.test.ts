/**
 * This module is intended to unit-test helper functions for Search* components
 */

import * as Model from './model';
import * as Action from './actions';
import * as Types from './actionTypes';
import { reducer } from './reducer';

const results = [
    {
        category: 'gene',
        results: [
            {
                title: 'a',
                description: '',
            },
            {
                title: 'b',
                description: '',
            },
        ],
    },
    {
        category: 'regulon',
        results: [
            {
                title: 'c',
                description: '',
            },
            {
                title: 'd',
                description: '',
            },
        ],
    },
    {
        category: 'Clustering: Leiden resolution 0.4 (default, 397)',
        results: [
            {
                title: 'All Clusters',
                description: '',
            },
            {
                title: 'Unannotated Cluster 1',
                description: 'test description',
            },
        ],
    },
];

describe('Model.findResult', () => {
    it('Makes a selection from valid results', () => {
        expect(Model.findResult({ title: 'c' }, 'red', results)).toStrictEqual({
            title: 'c',
            category: 'regulon',
            description: '',
            colour: 'red',
        });
    });

    it('Makes a selection from more valid results', () => {
        expect(
            Model.findResult({ title: 'All Clusters' }, 'green', results)
        ).toStrictEqual({
            title: 'All Clusters',
            category: 'Clustering: Leiden resolution 0.4 (default, 397)',
            description: '',
            colour: 'green',
        });
    });

    it('Makes a selection from empty results', () => {
        expect(Model.findResult({ title: 'c' }, 'red', [])).toBe(undefined);
    });

    it('Makes a selection where no results match', () => {
        expect(
            Model.findResult({ title: 'does not exist' }, 'blue', results)
        ).toBe(undefined);
    });
});

describe('Actions', () => {
    it('Should create a QUERY action', () => {
        const expected = {
            type: Types.QUERY,
            payload: {
                field: '',
                query: {
                    dataset: '',
                    category: 'gene',
                    query: 'test',
                },
            },
        };

        expect(Action.search('', '', 'gene', 'test')).toEqual(expected);
    });

    it('Should create a RESULTS action', () => {
        const expected = {
            type: Types.RESULTS,
            payload: {
                field: '',
                results: results,
            },
        };

        expect(Action.results('', results)).toEqual(expected);
    });

    it('Should create a SELECT action', () => {
        const selection: Model.FeatureSearchSelection = {
            title: 'test',
            category: 'annotation',
            description: 'A test',
            colour: 'blue',
        };

        const expected = {
            type: Types.SELECT,
            payload: {
                field: '',
                selection: selection,
            },
        };

        expect(Action.select('', selection)).toEqual(expected);
    });

    it('Should create an ERROR action', () => {
        const expected = {
            type: Types.ERROR,
            payload: {
                field: '',
                message: 'A test error',
            },
        };

        expect(Action.error('', 'A test error')).toEqual(expected);
    });
});

describe('Reducers', () => {
    it('Should handle a QUERY action', () => {
        const expected = {
            test: {
                field: 'test',
                loading: true,
                value: 'query',
                results: [],
                selected: undefined,
                error: undefined,
            },
        };

        expect(reducer({}, Action.search('test', '', 'gene', 'query'))).toEqual(
            expected
        );
    });

    it('Should handle a RESULTS action', () => {
        const expected = {
            test: {
                field: 'test',
                loading: false,
                value: '',
                results: results,
                selected: undefined,
                error: undefined,
            },
        };

        expect(reducer({}, Action.results('test', results))).toEqual(expected);
    });

    it('Should handle a SELECT action', () => {
        const expected = {
            test: {
                field: 'test',
                loading: false,
                value: 'b',
                results: [],
                selected: {
                    title: 'b',
                    category: 'gene',
                    description: '',
                    colour: 'green',
                },
                error: undefined,
            },
        };

        expect(
            reducer(
                {},
                Action.select('test', {
                    title: 'b',
                    category: 'gene',
                    description: '',
                    colour: 'green',
                })
            )
        ).toEqual(expected);
    });

    it('Should handle an ERROR action', () => {
        const expected = {
            test: {
                field: 'test',
                loading: false,
                value: '',
                results: [],
                selected: undefined,
                error: 'Error message',
            },
        };

        expect(reducer({}, Action.error('test', 'Error message'))).toEqual(
            expected
        );
    });
});
