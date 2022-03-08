import { call, put, debounce } from 'redux-saga/effects';

import * as ActionType from './actionTypes';
import * as Action from './actions';
import { SEARCH_API_DELAY } from './constants';
import { queryFeatures, Features } from '../../api';

function* getFeatures(action: Action.SearchQuery) {
    try {
        const features: Features[] = yield call(
            queryFeatures,
            action.payload.query
        );

        yield put(Action.results(action.payload.field, features));
    } catch (error: unknown) {
        yield put(
            Action.error(
                action.payload.field,
                `Could not query ${JSON.stringify(action.payload.query)}`
            )
        );
    }
}

function* getFeaturesSaga() {
    yield debounce(SEARCH_API_DELAY, ActionType.QUERY, getFeatures);
}

export { getFeaturesSaga, getFeatures };
