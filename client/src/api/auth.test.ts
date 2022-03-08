import 'jest';

import {
    requestAuthToken,
    AuthTokenResponse,
    AuthTokenRequest,
    requestGuestToken,
    requestAuthProviders,
    Provider,
} from './auth';
import { Result, match } from '../result';

const tokenResponse = (): AuthTokenResponse => {
    return {
        access_token: 'token',
        token_type: 'bearer',
        user: {
            name: 'test',
            role: 'guest',
            id: 0,
        },
        projects: [],
        datasets: [],
    };
};

// @ts-ignore
global.fetch = jest.fn(() => {
    return Promise.resolve({
        ok: true,
        json: () =>
            Promise.resolve({
                access_token: 'token',
                token_type: 'bearer',
                user: {
                    name: 'test',
                    role: 'guest',
                    id: 0,
                    projects: [],
                },
            }),
    });
});

// @ts-ignore
beforeEach(() => global.fetch.mockClear());

const req: AuthTokenRequest = {
    code: 'test',
    state: 'test',
};

describe('Get and decode auth tokens', () => {
    it('Requests and decodes a valid auth token', async () => {
        const result: Result<AuthTokenResponse, string> =
            await requestAuthToken(req);

        match(
            (token: AuthTokenResponse) =>
                expect(token).toStrictEqual(tokenResponse()),
            (err: string) => fail(err),
            result
        );
    });

    it('Fails gracefully', async () => {
        // @ts-ignore
        global.fetch.mockImplementationOnce(() =>
            Promise.reject({
                ok: false,
                statusText: 'API is down',
            })
        );

        const result: Result<AuthTokenResponse, string> =
            await requestAuthToken(req);

        match(
            (token: AuthTokenResponse) => fail(JSON.stringify(token)),
            (err: string) =>
                expect(err).toBe('Error in AuthToken request: API is down'),
            result
        );
    });
});

describe('Create a new guest', () => {
    it('Requests and decodes a valid auth token', async () => {
        const result: Result<AuthTokenResponse, string> =
            await requestGuestToken();

        match(
            (token: AuthTokenResponse) =>
                expect(token).toStrictEqual(tokenResponse()),
            (err: string) => fail(err),
            result
        );
    });

    it('Fails gracefully', async () => {
        // @ts-ignore
        global.fetch.mockImplementationOnce(() =>
            Promise.reject({
                ok: false,
                statusText: 'API is down',
            })
        );

        const result: Result<AuthTokenResponse, string> =
            await requestGuestToken();

        match(
            (token: AuthTokenResponse) => fail(JSON.stringify(token)),
            (err: string) =>
                expect(err).toBe(
                    'Error in guest AuthToken request: API is down'
                ),
            result
        );
    });
});

describe('Fetch auth providers', () => {
    it('Requests and decodes a valid list of auth providers', async () => {
        const providers = () => [
            {
                id: 1,
                name: 'test',
                url: 'http://login',
                icon: 'test.ico',
            },
        ];

        // @ts-ignore
        global.fetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(providers()),
            })
        );

        const result: Result<
            Array<Provider>,
            string
        > = await requestAuthProviders();

        match(
            (got: Array<Provider>) => expect(got).toStrictEqual(providers()),
            (err: string) => fail(err),
            result
        );
    });

    it('Fails gracefully', async () => {
        // @ts-ignore
        global.fetch.mockImplementationOnce(() =>
            Promise.reject({
                ok: false,
                statusText: 'API is down',
            })
        );

        const result: Result<
            Array<Provider>,
            string
        > = await requestAuthProviders();

        match(
            (got: Array<Provider>) => fail(JSON.stringify(got)),
            (err: string) =>
                expect(err).toBe(
                    'Error requesting auth providers: API is down'
                ),
            result
        );
    });
});
