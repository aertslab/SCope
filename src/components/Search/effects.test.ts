/**
 * This module tests the Sagas for Search
 */
import { call, put, throttle } from 'redux-saga/effects';
import { cloneableGenerator } from '@redux-saga/testing-utils';

import { SEARCH_API_DELAY } from './constants';
import { getFeatures, getFeaturesSaga } from './effects';
import { QUERY } from './actionTypes';
import { search, results, error } from './actions';
import { queryFeatures } from '../../api';

const exampleResults = [
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
];

describe('Query API side-effect', () => {
    const exampleField = '1';
    const exampleSearchQuery = 'query';
    const generator = cloneableGenerator(getFeatures)(
        search(exampleField, '', 'all', exampleSearchQuery)
    );

    it('Calls the queryFeatures API', () => {
        const result = generator.next().value;
        expect(result).toEqual(
            call(queryFeatures, {
                dataset: '',
                category: 'all',
                query: exampleSearchQuery,
            })
        );
    });

    describe('...and if the request is successful', () => {
        let clone;

        beforeAll(() => {
            clone = generator.clone();
        });

        it('Raises a RESULTS action', () => {
            const result = clone.next(exampleResults).value;
            expect(result).toEqual(put(results(exampleField, exampleResults)));
        });

        it('performs no further work', () => {
            const result = clone.next().done;
            expect(result).toBe(true);
        });
    });

    describe('...and if the request fails', () => {
        let clone;

        beforeAll(() => {
            clone = generator.clone();
        });

        it('Raises an ERROR action', () => {
            const err = 'No connection to back-end';
            const result = clone.throw(err).value;
            expect(result).toEqual(put(error(exampleField, err)));
        });

        it('performs no further work', () => {
            const result = clone.next().done;
            expect(result).toBe(true);
        });
    });
});
