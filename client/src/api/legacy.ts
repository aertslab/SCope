import { Result, error, success } from '../result';
import { API_URL } from './api';

export type LegacySession = {
    uuid: string;
};

const decodeLegacySession = (
    response: unknown
): Result<LegacySession, string> => {
    if (response === undefined) {
        return error('LegacySession was undefined');
    }

    if (typeof response === 'object') {
        if (
            response !== null &&
            'uuid' in response &&
            typeof (response as { uuid: unknown }).uuid === 'string'
        ) {
            return success(response as LegacySession);
        }
    }

    return error(`Cannot decode ${response} to a LegacySession`);
};

export async function requestDecodePermalink(
    sessiondata: string
): Promise<Result<LegacySession, string>> {
    try {
        const response = await fetch(API_URL + 'legacy/permalink', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessiondata }),
        });

        if (!response.ok) {
            return error(response.statusText);
        }

        const session: unknown = await response.json();
        return decodeLegacySession(session);
    } catch (err: unknown) {
        return error(`Unknown error: ${JSON.stringify(err)}`);
    }
}
