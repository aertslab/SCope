import { all } from 'redux-saga/effects';

import { fetchAvailableOrganismsSaga } from '../../components/GProfiler/sagas';
import {
    getFeaturesSaga,
    watchGuestLogin,
    watchRequestToken,
    watchRequestProviders,
} from './scope';

export default function* rootSaga() {
    yield all([
        fetchAvailableOrganismsSaga(),
        getFeaturesSaga(),
        watchGuestLogin(),
        watchRequestToken(),
        watchRequestProviders(),
    ]);
}
