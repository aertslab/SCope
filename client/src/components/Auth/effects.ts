import { call, put, takeEvery, throttle } from 'redux-saga/effects';

import { Result, match } from '../../result';
import {
    AuthTokenResponse,
    requestAuthToken,
    requestGuestToken,
    Provider,
    requestAuthProviders,
} from '../../api';

import * as t from './actionTypes';
import * as Action from './actions';

function* requestToken(action: Action.RequestToken) {
    const response: Result<AuthTokenResponse, string> = yield call(
        requestAuthToken,
        action.payload
    );

    yield put(
        match<AuthTokenResponse, string, Action.AuthAction>(
            (token: AuthTokenResponse) => {
                return Action.token(token);
            },
            (err: string) => {
                return Action.error(err);
            },
            response
        )
    );
}

function* watchRequestToken() {
    yield takeEvery(t.REQUEST_TOKEN, requestToken);
}

function* requestProviders() {
    const response: Result<Array<Provider>, string> = yield call(
        requestAuthProviders
    );

    yield put(
        match<Array<Provider>, string, Action.AuthAction>(
            (providers: Array<Provider>) => {
                return Action.providers(providers);
            },
            (err: string) => {
                return Action.error(err);
            },
            response
        )
    );
}

function* watchRequestProviders() {
    yield throttle(5000, t.REQUEST_PROVIDERS, requestProviders);
}

function* requestGuestLogin() {
    const response: Result<AuthTokenResponse, string> = yield call(
        requestGuestToken
    );

    yield put(
        match<AuthTokenResponse, string, Action.AuthAction>(
            (token: AuthTokenResponse) => Action.token(token),
            (err: string) => Action.error(err),
            response
        )
    );
}

function* watchGuestLogin() {
    yield takeEvery(t.AUTH_GUEST_LOGIN, requestGuestLogin);
}

export { watchGuestLogin, watchRequestToken, watchRequestProviders };
