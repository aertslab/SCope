/**
 * This module tests the Sagas for Auth
 */
import { call, put, takeEvery, throttle } from 'redux-saga/effects';
import { cloneableGenerator } from '@redux-saga/testing-utils';

import * as E from './effects';
import * as A from './actions';
import * as T from './actionTypes';
import * as API from '../../api';
import * as GR from '../../redux/actions';
import { success, error } from '../../result';

const exampleToken: API.AuthTokenResponse = {
    access_token: 'abcd',
    token_type: 'bearer',
    user: {
        name: 'Test',
        role: 'guest',
        id: 0,
    },
    projects: [],
    datasets: [],
};

describe('New guest user', () => {
    it('Listens for guest login actions', () => {
        // @ts-ignore
        const guestGen = cloneableGenerator(E.watchGuestLogin)(A.guestLogin);
        expect(guestGen.next().value).toEqual(
            takeEvery(T.AUTH_GUEST_LOGIN, E.requestGuestLogin)
        );

        expect(guestGen.next().done).toBe(true);
    });

    describe('Create a new guest token', () => {
        // @ts-ignore
        const guestGen = cloneableGenerator(E.requestGuestLogin)();
        it('Calls the new guest user API', () => {
            expect(guestGen.next().value).toEqual(call(API.requestGuestToken));
        });

        describe('...and if the request succeeds', () => {
            let clone;

            beforeAll(() => {
                clone = guestGen.clone();
            });

            it('Submits a token', () => {
                expect(clone.next(success(exampleToken)).value).toStrictEqual(
                    put(A.token(exampleToken))
                );
            });

            it('Submits user projects and datasets', () => {
                expect(clone.next(success(exampleToken)).value).toStrictEqual(
                    put(GR.myProjects([], []))
                );
            });

            it('performs no further work', () => {
                expect(clone.next().done).toBe(true);
            });
        });

        describe('...and if the request fails', () => {
            let clone;
            beforeAll(() => {
                clone = guestGen.clone();
            });

            it('Submits an error', () => {
                expect(clone.next(error('Error')).value).toStrictEqual(
                    put(A.error('Error'))
                );
            });

            it('Submits an error', () => {
                expect(clone.next(error('Error')).value).toStrictEqual(
                    put(
                        GR.error(
                            'Failed to retrieve projects with token: Error'
                        )
                    )
                );
            });

            it('performs no further work', () => {
                expect(clone.next().done).toBe(true);
            });
        });
    });
});

describe('OpenID Identity providers', () => {
    it('Listens for provider request actions', () => {
        const requestGen = cloneableGenerator(E.watchRequestProviders)(
            // @ts-ignore
            A.requestProviders
        );
        expect(requestGen.next().value).toEqual(
            throttle(5000, T.REQUEST_PROVIDERS, E.requestProviders)
        );

        expect(requestGen.next().done).toBe(true);
    });

    describe('Get providers', () => {
        // @ts-ignore
        const requestGen = cloneableGenerator(E.requestProviders)();
        it('Calls the providers API', () => {
            expect(requestGen.next().value).toEqual(
                call(API.requestAuthProviders)
            );
        });

        describe('...and if the request succeeds', () => {
            let clone;
            const exampleProviders: API.Provider[] = [
                {
                    id: 504,
                    name: 'Test',
                    icon: '',
                    url: 'https://a-login.com',
                },
                {
                    id: 32,
                    name: 'Cool',
                    icon: 'some-icon',
                    url: 'https://cool.org/',
                },
            ];

            beforeAll(() => {
                clone = requestGen.clone();
            });

            it('Submits list of providers', () => {
                expect(
                    clone.next(success(exampleProviders)).value
                ).toStrictEqual(put(A.providers(exampleProviders)));
            });

            it('performs no further work', () => {
                expect(clone.next().done).toBe(true);
            });
        });

        describe('...and if the request fails', () => {
            let clone;
            beforeAll(() => {
                clone = requestGen.clone();
            });

            it('Submits an error', () => {
                expect(clone.next(error('Error')).value).toStrictEqual(
                    put(A.error('Error'))
                );
            });

            it('performs no further work', () => {
                expect(clone.next().done).toBe(true);
            });
        });
    });
});

describe('SCope API token', () => {
    it('Listens for token request actions', () => {
        const requestGen = cloneableGenerator(E.watchRequestToken)(
            // @ts-ignore
            A.requestToken('abc', 'def')
        );
        expect(requestGen.next().value).toEqual(
            takeEvery(T.REQUEST_TOKEN, E.requestToken)
        );

        expect(requestGen.next().done).toBe(true);
    });

    describe('Get token', () => {
        // @ts-ignore
        const requestGen = cloneableGenerator(E.requestToken)(
            A.requestToken('abc', 'def')
        );
        const authCode: API.AuthTokenRequest = { code: 'abc', state: 'def' };
        it('Calls the authorize API', () => {
            expect(requestGen.next().value).toEqual(
                call(API.requestAuthToken, authCode)
            );
        });

        describe('...and if the request succeeds', () => {
            let clone;

            beforeAll(() => {
                clone = requestGen.clone();
            });

            it('Submits a token', () => {
                expect(clone.next(success(exampleToken)).value).toStrictEqual(
                    put(A.token(exampleToken))
                );
            });

            it('Submits user projects and datasets', () => {
                expect(clone.next(success(exampleToken)).value).toStrictEqual(
                    put(GR.myProjects([], []))
                );
            });

            it('performs no further work', () => {
                expect(clone.next().done).toBe(true);
            });
        });

        describe('...and if the request fails', () => {
            let clone;
            beforeAll(() => {
                clone = requestGen.clone();
            });

            it('Submits an error', () => {
                expect(clone.next(error('Error')).value).toStrictEqual(
                    put(A.error('Error'))
                );
            });

            it('performs no further work', () => {
                expect(clone.next().done).toBe(true);
            });
        });
    });
});
