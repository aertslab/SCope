import { call, put, takeEvery } from 'redux-saga/effects';

import { Result, match } from '../../result';
import { LegacySession, requestDecodePermalink } from '../../api';

import * as t from './actionTypes';
import * as Action from './actions';

function* decodePermalink(action: Action.DecodeSessionData) {
    const response: Result<LegacySession, string> = yield call(
        requestDecodePermalink,
        action.payload.sessiondata
    );

    yield put(
        match<LegacySession, string, Action.ActionT>(
            (_session: LegacySession) => {
                return Action.error('Not implemented');
            },
            (err: string) => {
                return Action.error(err);
            },
            response
        )
    );
}

function* watchPermalinkRequests() {
    yield takeEvery(t.DECODE_LEGACY_PERMALINK, decodePermalink);
}

export { watchPermalinkRequests };
