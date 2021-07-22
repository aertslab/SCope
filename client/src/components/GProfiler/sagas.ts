import { put, takeLatest, call } from 'redux-saga/effects';
import { Either, either } from 'sanctuary';

import { fetchJson } from '../../api/fetch';
import * as t from './actionTypes';

import * as c from './constants';
import { GProfilerOrganism } from './model';
import * as Action from './actions';

function* fetchAvailableOrganisms() {
    const organisms: Either<string, Array<GProfilerOrganism>> = yield call(
        fetchJson,
        c.GPROFILER_API_ENDPOINT__AVAILABLE_ORGANISMS
    );

    const action = either((err) =>
        Action.setError(`Unable to fetch list of organisms: ${err}`)
    )(Action.setAvailableOrganisms)(organisms);

    yield put(action);
}

function* fetchAvailableOrganismsSaga() {
    yield takeLatest(t.FETCH_AVAILABLE_ORGANISMS, fetchAvailableOrganisms);
}

export { fetchAvailableOrganismsSaga, fetchAvailableOrganisms };
