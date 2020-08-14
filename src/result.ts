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
