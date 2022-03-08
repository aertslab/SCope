import 'jest';

import * as R from 'ramda';

import {
    Result,
    chain,
    error,
    success,
    isError,
    isSuccess,
    withDefault,
    match,
    map,
    mapError,
    of,
} from './result';

describe('Check constructors', () => {
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
        expect(withDefault('hello', error('test'))).toBe('hello');
    });

    it('Can match either side of a result', () => {
        const ok_op = (x) => x;
        const err_op = (y) => `Error: ${y}`;

        expect(match(ok_op, err_op, success(5))).toBe(5);
        expect(match(ok_op, err_op, error('test'))).toBe('Error: test');
    });

    it('Can map the Success side', () => {
        expect(
            withDefault(
                0,
                map((v: string) => v.length, success('test'))
            )
        ).toEqual(4);

        expect(
            match(
                (x: number): string => `Success ${x}`,
                R.identity,
                map((v: string) => v.length, error('test'))
            )
        ).toEqual('test');
    });

    it('Can map the error side', () => {
        expect(
            match(
                R.identity,
                R.identity,
                mapError((e: number) => `Error ${e}`, error(5))
            )
        ).toEqual('Error 5');

        expect(
            match(
                R.identity,
                R.identity,
                mapError((e: number) => `Error ${e}`, success('test'))
            )
        ).toEqual('test');
    });

    it('Can chain results', () => {
        const res = chain(success(5), (a) => success(a * 2));
        expect(isSuccess(res)).toBe(true);
        expect(withDefault(0, res)).toEqual(10);
    });

    it('Works with Ramda map and sequence', () => {
        expect(withDefault('', R.map(R.toString, success(5)))).toBe('5');

        expect(
            withDefault([], R.sequence(of, [success(1), success(2)]))
        ).toStrictEqual([1, 2]);

        expect(
            withDefault([], R.sequence(of, [success(1), error(2)]))
        ).toStrictEqual([]);
    });

    it('Works with Ramda chain', () => {
        // @ts-ignore
        const res = R.chain(
            // @ts-ignore
            (a: number) => success(a * 2),
            success(4)
        ) as Result<number, unknown>;
        expect(isSuccess(res)).toBe(true);
        expect(withDefault(0, res)).toEqual(8);

        // @ts-ignore
        const err = R.chain(
            // @ts-ignore
            (a: number) => success(a * 3),
            error('error')
        ) as Result<number, string>;
        expect(isError(err)).toBe(true);
        expect(withDefault(0, err)).toEqual(0);
    });
});
