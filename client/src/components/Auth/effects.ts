import { call, put, takeEvery, throttle } from 'redux-saga/effects';

import { myProjects as myProjectsAction, error } from '../../redux/actions';
import { MainAction } from '../../redux/types';

import { Result, match } from '../../result';
import * as API from '../../api';

import * as t from './actionTypes';
import * as Action from './actions';

export function* requestToken(action: Action.RequestToken) {
    const response: Result<API.AuthTokenResponse, string> = yield call(
        API.requestAuthToken,
        action.payload
    );

    yield put(
        match<API.AuthTokenResponse, string, Action.AuthAction>(
            (token: API.AuthTokenResponse) => Action.token(token),
            (err: string) => Action.error(err),
            response
        )
    );

    yield put(
        match<API.AuthTokenResponse, string, MainAction>(
            (token: API.AuthTokenResponse) =>
                myProjectsAction(token.projects, token.datasets),
            (err) => error(`Failed to retrieve projects with token: ${err}`),
            response
        )
    );
}

export function* watchRequestToken() {
    yield takeEvery(t.REQUEST_TOKEN, requestToken);
}

export function* requestProviders() {
    const response: Result<Array<API.Provider>, string> = yield call(
        API.requestAuthProviders
    );

    yield put(
        match<Array<API.Provider>, string, Action.AuthAction>(
            (providers: Array<API.Provider>) => {
                return Action.providers(providers);
            },
            (err: string) => {
                return Action.error(err);
            },
            response
        )
    );
}

export function* watchRequestProviders() {
    yield throttle(5000, t.REQUEST_PROVIDERS, requestProviders);
}

export function* requestGuestLogin() {
    const response: Result<API.AuthTokenResponse, string> = yield call(
        API.requestGuestToken
    );

    yield put(
        match<API.AuthTokenResponse, string, Action.AuthAction>(
            (token: API.AuthTokenResponse) => Action.token(token),
            (err: string) => Action.error(err),
            response
        )
    );

    yield put(
        match<API.AuthTokenResponse, string, MainAction>(
            (token: API.AuthTokenResponse) =>
                myProjectsAction(token.projects, token.datasets),
            (err) => error(`Failed to retrieve projects with token: ${err}`),
            response
        )
    );
}

export function* watchGuestLogin() {
    yield takeEvery(t.AUTH_GUEST_LOGIN, requestGuestLogin);
}
