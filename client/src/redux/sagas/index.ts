import { all } from 'redux-saga/effects';

import { fetchAvailableOrganismsSaga } from '../../components/GProfiler/sagas';
import * as SCOPE from './scope';

export default function* rootSaga() {
    yield all([
        fetchAvailableOrganismsSaga(),
        SCOPE.getFeaturesSaga(),
        SCOPE.watchGuestLogin(),
        SCOPE.watchRequestToken(),
        SCOPE.watchRequestProviders(),
        SCOPE.watchPermalinkRequests(),
        SCOPE.watchCreateNewProject(),
    ]);
}
