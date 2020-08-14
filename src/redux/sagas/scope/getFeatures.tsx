import { call, put, takeLatest } from 'redux-saga/effects';

import * as t from '../../../components/Search/actionTypes';
import { SearchQuery } from '../../../components/Search/actions';
import { queryFeatures, FeatureQuery } from '../../../api';

function* getFeatures(action: SearchQuery) {
    const [features, request] = yield call(queryFeatures, action.payload.query);
    yield put({
        type: t.RESULTS,
        payload: { results: features, field: action.payload.field },
    });
}

function* getFeaturesSaga() {
    yield takeLatest(t.QUERY, getFeatures);
}

export { getFeaturesSaga };
