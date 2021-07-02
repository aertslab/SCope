import 'jest';

import {
    error,
    success,
    isError,
    isSuccess,
    withDefault,
    match,
    map,
    mapError,
} from './result';

describe('Check constructors', () => {
    it('Can create Success', () => {
        expect(success(5)).toEqual({ kind: 'Success', value: 5 });
    });

    it('Can create Error', () => {
        expect(error('error')).toEqual({ kind: 'Error', error: 'error' });
    });

    it('Can check if a Result is a success', () => {
        expect(isSuccess(success(0))).toBe(true);
        expect(isError(success(1))).toBe(false);
    });

    it('Can check if a Result is an error', () => {
        expect(isError(error(1))).toBe(true);
        expect(isSuccess(error(0))).toBe(false);
    });
});

describe('Operations on Result', () => {
    it('Can have a default value', () => {
        expect(withDefault('hello', success('world'))).toEqual('world');
        expect(withDefault('hello', error(5))).toBe('hello');
    });

    it('Can match either side of a result', () => {
        const ok_op = (x) => x;
        const err_op = (y) => `Error: ${y}`;

        expect(match(ok_op, err_op, success(5))).toBe(5);
        expect(match(ok_op, err_op, error('test'))).toBe('Error: test');
    });

    it('Can map the Success side', () => {
        expect(map((v) => v.length, success('test'))).toEqual(success(4));
        expect(map((v: string) => v.length, error('test'))).toEqual(
            error('test')
        );
    });

    it('Can map the error side', () => {
        expect(mapError((e) => `Error ${e}`, error(5))).toEqual(
            error('Error 5')
        );
        expect(mapError((e: number) => `Error ${e}`, success('test'))).toEqual(
            success('test')
        );
    });
});
