import { Result, error } from '../result';

export const handleError = <T>(
    prefix: string,
    err: unknown
): Result<T, string> => {
    if (err === undefined) {
        return error(prefix + ' undefined');
    }

    if (
        typeof err === 'object' &&
        err !== null &&
        'statusText' in err &&
        typeof (err as { statusText: unknown }).statusText === 'string'
    ) {
        const msg = (err as { statusText: string }).statusText;
        return error(`${prefix} ${msg}`);
    }

    return error(`${prefix} ${JSON.stringify(err)}`);
};
