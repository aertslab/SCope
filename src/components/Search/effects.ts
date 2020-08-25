import { call, put, throttle } from 'redux-saga/effects';

import * as t from './actionTypes';
import * as Action from './actions';
import { queryFeatures, FeatureQuery, Features } from '../../api';

const DELAY: number = 750;

function* getFeatures(action: Action.SearchQuery) {
    try {
        const features: Features[] = yield call(
            queryFeatures,
            action.payload.query
        );

        yield put(Action.results(action.payload.field, features));
    } catch (error) {
        yield put(Action.error(action.payload.field, error));
    }
}

function* getFeaturesSaga() {
    yield throttle(DELAY, t.QUERY, getFeatures);
}

export { getFeaturesSaga };
