import { put, takeLatest, call } from 'redux-saga/effects';
import * as R from 'ramda';

import { fetchJson } from '../../api/fetch';
import * as t from './actionTypes';
import * as c from './constants';
import { GProfilerOrganism } from './model';
import * as Action from './actions';

function* fetchAvailableOrganisms() {
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
