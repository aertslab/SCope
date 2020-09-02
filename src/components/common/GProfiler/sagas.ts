import { put, takeLatest, call } from 'redux-saga/effects';
import * as R from 'ramda';

import * as t from './actionTypes';
import * as c from './constants';
import { GProfilerOrganism } from './types';
import * as Action from './actions';

async function fetchJson(url: string) {
    let resp = null;
    try {
        let data = await fetch(url);
        resp = { data: await data.json() };
    } catch (e) {
        resp = { err: e.message };
    }
    return resp;
}

function* fetchAvailableOrganisms() {
    yield put(Action.fetchingAvailableOrganisms(true));
    const { data } = yield call(
        fetchJson,
        c.GPROFILER_API_ENDPOINT__AVAILABLE_ORGANISMS
    );
    if (!!data && !('message' in data)) {
        const organismsSorted = data
            .map((organism: GProfilerOrganism, idx: number) => {
                return {
                    key: idx + 1,
                    text: organism.display_name,
                    value: organism.id,
                };
            })
            .sort(R.comparator((a, b) => a['text'] < b['text']));
        yield put(Action.setAvailableOrganisms(organismsSorted));
    } else {
        yield put(Action.setError('Unable to fetch list of organisms'));
    }
}

function* fetchAvailableOrganismsSaga() {
    yield takeLatest(t.FETCH_AVAILABLE_ORGANISMS, fetchAvailableOrganisms);
}

export { fetchAvailableOrganismsSaga };
