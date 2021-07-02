import { put, takeLatest, call } from 'redux-saga/effects';

import { fetchJson } from '../../api/fetch';
import * as t from './actionTypes';
import { Result, match } from '../../result';

import * as c from './constants';
import { GProfilerOrganism } from './model';
import * as Action from './actions';

function* fetchAvailableOrganisms() {
    const organisms: Result<Array<GProfilerOrganism>, string> = yield call(
        fetchJson,
        c.GPROFILER_API_ENDPOINT__AVAILABLE_ORGANISMS
    );

    yield put(
        match<Array<GProfilerOrganism>, string, Action.GProfilerAction>(
            (orgs) => Action.setAvailableOrganisms(orgs),
            (err) =>
                Action.setError(`Unable to fetch list of organisms: ${err}`),
            organisms
        )
    );
}

function* fetchAvailableOrganismsSaga() {
    yield takeLatest(t.FETCH_AVAILABLE_ORGANISMS, fetchAvailableOrganisms);
}

export { fetchAvailableOrganismsSaga, fetchAvailableOrganisms };
