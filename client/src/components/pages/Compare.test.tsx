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

    it('Handles real data (cross-reference; all 4 grid squares set)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Genotype: ['DGRP-551'] }, { Genotype: ['W1118'] }],
            vertical: [{ Gender: ['Female'] }, { Gender: ['Male'] }],
        };

        [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ].map(([i, j]) => {
            expect(getCrossAnnotationsOld(cross, i, j)).toStrictEqual(
                getCrossAnnotations(cross, i, j)
            );
        });
    });

    it('Handles real data (cross-reference; both columns, top row)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Genotype: ['DGRP-551'] }, { Genotype: ['W1118'] }],
            vertical: [{ Gender: ['Female'] }, {}],
        };

        [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ].map(([i, j]) => {
            expect(getCrossAnnotationsOld(cross, i, j)).toStrictEqual(
                getCrossAnnotations(cross, i, j)
            );
        });
    });

    it('Handles real data (cross-reference; both columns, bottom row)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Genotype: ['DGRP-551'] }, { Genotype: ['W1118'] }],
            vertical: [{}, { Gender: ['Male'] }],
        };

        [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ].map(([i, j]) => {
            expect(getCrossAnnotationsOld(cross, i, j)).toStrictEqual(
                getCrossAnnotations(cross, i, j)
            );
        });
    });

    it('Handles real data (cross-reference; left column, both rows)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Genotype: ['DGRP-551'] }, {}],
            vertical: [{ Gender: ['Female'] }, { Gender: ['Male'] }],
        };

        [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ].map(([i, j]) => {
            expect(getCrossAnnotationsOld(cross, i, j)).toStrictEqual(
                getCrossAnnotations(cross, i, j)
            );
        });
    });

    it('Handles real data (cross-reference; right column, both rows)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{}, { Genotype: ['W1118'] }],
            vertical: [{ Gender: ['Female'] }, { Gender: ['Male'] }],
        };

        [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ].map(([i, j]) => {
            expect(getCrossAnnotationsOld(cross, i, j)).toStrictEqual(
                getCrossAnnotations(cross, i, j)
            );
        });
    });

    it('Handles real data (cross-reference; 2 displays)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Gender: ['Female'] }, { Gender: ['Male'] }],
            vertical: [{ Age: ['0'] }],
        };

        [
            [0, 0],
            [0, 1],
        ].map(([i, j]) => {
            expect(getCrossAnnotationsOld(cross, i, j)).toStrictEqual(
                getCrossAnnotations(cross, i, j)
            );
        });
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

    it('Handles real data (cross-reference; all 4 grid squares set)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Genotype: ['DGRP-551'] }, { Genotype: ['W1118'] }],
            vertical: [{ Gender: ['Female'] }, { Gender: ['Male'] }],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles real data (cross-reference; both columns, top row)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Genotype: ['DGRP-551'] }, { Genotype: ['W1118'] }],
            vertical: [{ Gender: ['Female'] }, {}],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles real data (cross-reference; both columns, bottom row)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Genotype: ['DGRP-551'] }, { Genotype: ['W1118'] }],
            vertical: [{}, { Gender: ['Male'] }],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles real data (cross-reference; left column, both rows)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Genotype: ['DGRP-551'] }, {}],
            vertical: [{ Gender: ['Female'] }, { Gender: ['Male'] }],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles real data (cross-reference; right column, both rows)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{}, { Genotype: ['W1118'] }],
            vertical: [{ Gender: ['Female'] }, { Gender: ['Male'] }],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });

    it('Handles real data (cross-reference; 2 displays)', () => {
        const cross: CrossAnnotations = {
            both: [],
            one: [],
            horizontal: [{ Gender: ['Female'] }, { Gender: ['Male'] }],
            vertical: [{ Age: ['0'] }],
        };

        expect(getSelectedAnnotationsOld(cross)).toStrictEqual(
            getSelectedAnnotations(cross)
        );
    });
});
