import { combineReducers } from 'redux';
import main from './main';
import { reducer as GProfilerReducer } from '../../components/GProfiler/reducer';
import * as GProfiler from '../../components/GProfiler/constants';

const rootReducer = combineReducers({
    ['main']: main,
    [GProfiler.NAME]: GProfilerReducer,
});

export default rootReducer;
export type RootState = ReturnType<typeof rootReducer>;
