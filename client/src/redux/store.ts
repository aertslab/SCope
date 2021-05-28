import { createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { composeWithDevTools } from 'redux-devtools-extension';

import rootReducer from './reducers';
import rootSaga from './sagas';

export default function configureStore(preloadedState: any) {
    const sagaMiddleware = createSagaMiddleware();
    const middleware = [sagaMiddleware];
    const mwEnhancer = applyMiddleware(...middleware);

    const enhancers = [mwEnhancer];
    const composedEnhancers = composeWithDevTools(...enhancers);

    const store = createStore(rootReducer, preloadedState, composedEnhancers);

    sagaMiddleware.run(rootSaga);

    return store;
}
