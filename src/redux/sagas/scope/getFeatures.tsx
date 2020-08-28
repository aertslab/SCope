import { call, put, throttle } from 'redux-saga/effects';

import * as t from '../../../components/Search/actionTypes';
import { SearchQuery } from '../../../components/Search/actions';
import { queryFeatures, FeatureQuery, Features } from '../../../api';

const DELAY: number = 750;

function* getFeatures(action: SearchQuery) {
    const features: Features[] = yield call(
        queryFeatures,
        action.payload.query
    );

    yield put({
        type: t.RESULTS,
        payload: { results: features, field: action.payload.field },
    });
}

function* getFeaturesSaga() {
    yield throttle(DELAY, t.QUERY, getFeatures);
}

export { getFeaturesSaga };
