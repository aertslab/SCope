import { call, put, throttle } from 'redux-saga/effects';

import * as ActionType from './actionTypes';
import * as Action from './actions';
import { SEARCH_API_DELAY } from './constants';
import { queryFeatures, FeatureQuery, Features } from '../../api';

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
    yield throttle(SEARCH_API_DELAY, ActionType.QUERY, getFeatures);
}

export { getFeaturesSaga, getFeatures };
