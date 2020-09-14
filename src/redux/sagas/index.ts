import { all } from 'redux-saga/effects';

import { fetchAvailableOrganismsSaga } from '../../components/GProfiler/sagas';
import { getFeaturesSaga } from './scope';

export default function* rootSaga() {
    yield all([fetchAvailableOrganismsSaga(), getFeaturesSaga()]);
}
