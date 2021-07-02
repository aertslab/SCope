type SuccessT<T> = {
    kind: 'Success';
    value: T;
};

type ErrorT<T> = {
    kind: 'Error';
    error: T;
};

export type Result<S, E> = SuccessT<S> | ErrorT<E>;

export function success<T>(value: T): SuccessT<T> {
    return {
        kind: 'Success',
        value,
    };
}

export function error<T>(err: T): ErrorT<T> {
    return {
        kind: 'Error',
        error: err,
    };
}

export function isSuccess<S, E>(result: Result<S, E>): result is SuccessT<S> {
    return result.kind === 'Success';
}

export function isError<S, E>(result: Result<S, E>): result is ErrorT<E> {
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

export function map<S, T, E>(
    fn: (_val: S) => T,
    result: Result<S, E>
): Result<T, E> {
    if (isSuccess(result)) {
        return success(fn(result.value));
    }
    return result;
}

export function mapError<S, E, F>(
    fn: (_val: E) => F,
    result: Result<S, E>
): Result<S, F> {
    if (isError(result)) {
        return error(fn(result.error));
    }

    return result;
}
