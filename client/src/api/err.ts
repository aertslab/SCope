import { Result, error } from '../result';

export const handleError = <T>(
    prefix: string | undefined,
    err: unknown
): Result<T, string> => {
    const message = (msg: string): string => {
        if (prefix) {
            return `${prefix} ${msg}`;
        } else {
            return msg;
        }
    };

    if (err === undefined) {
        return error(message('undefined'));
    }

    if (
        typeof err === 'object' &&
        err !== null &&
        'statusText' in err &&
        typeof (err as { statusText: unknown }).statusText === 'string'
    ) {
        const msg = (err as { statusText: string }).statusText;
        return error(message(msg));
    }

    return error(message(JSON.stringify(err)));
};
