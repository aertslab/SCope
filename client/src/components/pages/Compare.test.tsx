/**
 * This module is intended to test changes and simplifications to the Compare page
 */

import {
    CrossAnnotations,
    getCrossAnnotations,
    getCrossAnnotationsOld,
    getSelectedAnnotations,
    getSelectedAnnotationsOld,
} from './compareHelper';

describe('Check getCrossAnnotations', () => {
    it('Handles an empty cross object', () => {
        const cross: CrossAnnotations = {
            vertical: [],
            horizontal: [],
            both: [],
            one: [],
        };

        expect(getCrossAnnotationsOld(cross, 0, 0)).toStrictEqual(
            getCrossAnnotations(cross, 0, 0)
        );
    });

    it('Handles a singleton value in each', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo'] }],
            horizontal: [{ b: ['bar'] }],
            both: [],
            one: [],
        };

        expect(getCrossAnnotationsOld(cross, 0, 0)).toStrictEqual(
            getCrossAnnotations(cross, 0, 0)
        );
    });

    it('Handles equal horizontal and vertical', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo'] }],
            horizontal: [{ a: ['foo'] }],
            both: [],
            one: [],
        };

        expect(getCrossAnnotationsOld(cross, 0, 0)).toStrictEqual(
            getCrossAnnotations(cross, 0, 0)
        );
    });

    it('Handles equal keys different values', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo'] }],
            horizontal: [{ a: ['bar'] }],
            both: [],
            one: [],
        };

        expect(getCrossAnnotationsOld(cross, 0, 0)).toStrictEqual(
            getCrossAnnotations(cross, 0, 0)
        );
    });

    it('Handles equal keys with multiple different values', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo', 'bar'] }],
            horizontal: [{ a: ['baz', 'zzz'] }],
            both: [],
            one: [],
        };

        expect(getCrossAnnotationsOld(cross, 0, 0)).toStrictEqual(
            getCrossAnnotations(cross, 0, 0)
        );
    });

    it('Handles equal keys with multiple equal values', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo', 'bar', 'foo', 'bar'] }],
            horizontal: [{ a: ['baz', 'zzz', 'zzz'] }],
            both: [],
            one: [],
        };

        expect(getCrossAnnotationsOld(cross, 0, 0)).toStrictEqual(
            getCrossAnnotations(cross, 0, 0)
        );
    });
});

describe('Check getSelectedAnnotations', () => {
    it('Handles an empty cross object', () => {
        const cross: CrossAnnotations = {
            vertical: [],
            horizontal: [],
            both: [],
            one: [],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles a singleton value in each', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo'] }],
            horizontal: [{ b: ['bar'] }],
            both: [],
            one: [],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles equal horizontal and vertical', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo'] }],
            horizontal: [{ a: ['foo'] }],
            both: [],
            one: [],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles equal keys different values', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo'] }],
            horizontal: [{ a: ['bar'] }],
            both: [],
            one: [],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles equal keys with multiple different values', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo', 'bar'] }],
            horizontal: [{ a: ['baz', 'zzz'] }],
            both: [],
            one: [],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles equal keys with multiple equal values', () => {
        const cross: CrossAnnotations = {
            vertical: [{ a: ['foo', 'bar', 'foo', 'bar'] }],
            horizontal: [{ a: ['baz', 'zzz', 'zzz'] }],
            both: [],
            one: [],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });
});
