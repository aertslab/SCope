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

export function is_success<S, E>(result: Result<S, E>): result is SuccessT<S> {
    return result.kind === 'Success';
}

export function is_error<S, E>(result: Result<S, E>): result is ErrorT<E> {
    return result.kind === 'Error';
}

export function with_default<S, E>(defaultval: S, result: Result<S, E>): S {
    if (is_success(result)) {
        return result.value;
    }

    return defaultval;
}

export function match<S, E, V>(
    ok: (val: S) => V,
    err: (val: E) => V,
    result: Result<S, E>
): V {
    if (is_success(result)) {
        return ok(result.value);
    } else {
        return err(result.error);
    }
}

export function map<S, T, E>(
    fn: (val: S) => T,
    result: Result<S, E>
): Result<T, E> {
    if (is_success(result)) {
        return success(fn(result.value));
    }
    return result;
}

export function map_error<S, E, F>(
    fn: (val: E) => F,
    result: Result<S, E>
): Result<S, F> {
    if (is_error(result)) {
        return error(fn(result.error));
    }

    return result;
}
