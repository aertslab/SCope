import { call, put, takeEvery, throttle } from 'redux-saga/effects';

import { myProjects as myProjectsAction } from '../../redux/actions';
import { MyProjects } from '../../redux/types';

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
            (token: API.AuthTokenResponse) => {
                return Action.token(token);
            },
            (err: string) => {
                return Action.error(err);
            },
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
}

export function* watchGuestLogin() {
    yield takeEvery(t.AUTH_GUEST_LOGIN, requestGuestLogin);
}

export function* requestMyProjects(action: Action.AuthToken) {
    const response: Result<[API.Project[], API.DataSet[]], string> = yield call(
        API.myProjects,
        action.payload.access_token
    );

    yield put(
        match<[API.Project[], API.DataSet[]], string, MyProjects>(
            ([projects, datasets]) => myProjectsAction(projects, datasets),
            (_err) => myProjectsAction([], []),
            response
        )
    );
}

export function* watchAuthorized() {
    yield takeEvery(t.AUTH_TOKEN, requestMyProjects);
}
