import { combineReducers } from 'redux';
import main from './main';
import { reducer as GProfilerReducer } from '../../components/GProfiler/reducer';
import * as GProfiler from '../../components/GProfiler/constants';

import { reducer as SearchReducer } from '../../components/Search/reducer';
import * as Search from '../../components/Search/constants';

const rootReducer = combineReducers({
    ['main']: main,
    [GProfiler.NAME]: GProfilerReducer,
    [Search.NAME]: SearchReducer,
});

export default rootReducer;
export type RootState = ReturnType<typeof rootReducer>;
