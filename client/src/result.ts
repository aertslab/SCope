/**
 * A Result<Success, Error> type.
 *
 * Result<T, E> is used for returning and propagating errors. Functions
 * should return a Result when errors are expected and recoverable.
 *
 * This type implements the following Fantasyland specs:
 *   - Functor: https://github.com/fantasyland/fantasy-land#functor
 *   - Apply: https://github.com/fantasyland/fantasy-land#apply
 *   - Applicative: https://github.com/fantasyland/fantasy-land#applicative
 *   - Chain: https://github.com/fantasyland/fantasy-land#chain
 */

import { Functor } from 'ramda';

declare module 'ramda' {
    export const sequence: any;
}

// Chain typeclass definition
// class Chain m where
//   chain :: forall a b. m a ~> (a -> m b) -> m b
type Chain<A> =
    | {
          ['fantasy-land/chain']: <B>(_fn: (_a: A) => Chain<B>) => Chain<B>;
          [key: string]: any;
      }
    | { chain: <B>(_fn: (_a: A) => Chain<B>) => Chain<B>; [key: string]: any };

export type Result<T, E> = (
    | { kind: 'Success'; value: T }
    | { kind: 'Error'; error: E }
) &
    Functor<T> &
    Chain<T>;

export function success<T, E>(value: T): Result<T, E> {
    return {
        kind: 'Success',
        value,
        map: (fn) => success(fn(value)),
        ap: (f) => f.map(value),
        'fantasy-land/chain': (fn) => fn(value),
    };
}

export function error<T, E>(err: E): Result<T, E> {
    return {
        kind: 'Error',
        error: err,
        map: (_fn) => error(err),
        ap: (_f) => error(err),
        'fantasy-land/chain': (_fn) => error(err),
    };
}

export function of<S, E>(value: S): Result<S, E> {
    return success(value);
}

export function isSuccess<S, E>(result: Result<S, E>): boolean {
    return result.kind === 'Success';
}

export function isError<S, E>(result: Result<S, E>): boolean {
    return result.kind === 'Error';
}

export function withDefault<S, E>(defaultval: S, result: Result<S, E>): S {
    if (isSuccess(result)) {
        return result.value;
    }

    return defaultval;
}

export function match<S, E, V>(
    ok: (_val: S) => V,
    err: (_val: E) => V,
    result: Result<S, E>
): V {
    if (isSuccess(result)) {
        return ok(result.value);
    } else {
        return err(result.error);
    }
}

export function map<S, E, T>(
    fn: (_val: S) => T,
    result: Result<S, E>
): Result<T, E> {
    return result.map(fn);
}

export function mapError<S, E, F>(
    fn: (_val: E) => F,
    result: Result<S, E>
): Result<S, F> {
    if (isError(result)) {
        return error(fn(result.error));
    }

    return result as unknown as Result<S, F>;
}

export function chain<S, E, T>(
    result: Result<S, E>,
    fn: (_unwrapped: S) => Result<T, E>
): Result<T, E> {
    return result['fantasy-land/chain'](fn);
}
