import { combineReducers } from 'redux';
import main from './main';
import { reducer as GProfilerReducer } from '../../components/common/GProfiler/reducer';
import * as GProfiler from '../../components/common/GProfiler/constants';

const rootReducer = combineReducers({
    ['main']: main,
    [GProfiler.NAME]: GProfilerReducer,
});

export default rootReducer;
export type RootState = ReturnType<typeof rootReducer>;
