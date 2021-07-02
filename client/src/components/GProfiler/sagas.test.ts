/**
 * This module tests Sagas for GProfiler
 */
import 'jest';

import { call, put } from 'redux-saga/effects';
import { cloneableGenerator } from '@redux-saga/testing-utils';

import { fetchJson } from '../../api/fetch';
import { success, error } from '../../result';

import { fetchAvailableOrganisms } from './sagas';
import { setAvailableOrganisms, setError } from './actions';
import { GPROFILER_API_ENDPOINT__AVAILABLE_ORGANISMS } from './constants';

const exampleResults = [
    {
        display_name: 'test1',
        id: '0',
        scientific_name: 'sci test 1',
        version: '0',
    },
    {
        display_name: 'test2',
        id: '1',
        scientific_name: 'sci test 2',
        version: '34',
    },
];

describe('Query API side-effect', () => {
    // @ts-ignore
    const generator = cloneableGenerator(fetchAvailableOrganisms)();

    it('Calls the GProfiler API', () => {
        const result = generator.next().value;
        expect(result).toEqual(
            call(fetchJson, GPROFILER_API_ENDPOINT__AVAILABLE_ORGANISMS)
        );
    });

    describe('...and if the request was successful', () => {
        let clone;

        beforeAll(() => {
            clone = generator.clone();
        });

        it('Raises a SET_AVAILABLE_ORGANISMS action', () => {
            const result = clone.next(success(exampleResults)).value;
            expect(result).toEqual(put(setAvailableOrganisms(exampleResults)));
        });

        it('performs no further work', () => {
            expect(clone.next().done).toBe(true);
        });
    });

    describe('...and if the request fails', () => {
        let clone;

        beforeAll(() => {
            clone = generator.clone();
        });

        it('Raises a SET_ERROR action', () => {
            const msg = 'Error message';
            const result = clone.next(error(msg)).value;
            expect(result).toEqual(
                put(setError(`Unable to fetch list of organisms: ${msg}`))
            );
        });

        it('performs no further work', () => {
            expect(clone.next().done).toBe(true);
        });
    });
});
