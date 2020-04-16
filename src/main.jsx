import * as React from 'react';
import { render } from 'react-dom';
import App from './components/App';
import 'semantic-ui-css/semantic.min.css';
import './css/header.css';
import './css/sidebar.css';
import './css/viewer.css';
import './css/features.css';
import { HashRouter, Route } from 'react-router-dom';
import { CookiesProvider } from 'react-cookie';
import { configureStore } from '@reduxjs/toolkit';
import { connect, Provider } from 'react-redux';

import dummyReducer, { setLoading } from './stores/dummy/Reducer';

const store = configureStore({
    reducer: {
        dummyReducer: dummyReducer
    }
});

const mapState = (state) => {
    const { isLoading } = state.dummyReducer;
    return {
        isLoading
    };
};

const actionCreators = {
    setLoading
};

const ConnectedApp = connect(
    mapState,
    actionCreators
)(function(props) {
    return (
        <CookiesProvider>
            <HashRouter>
                <Route
                    path='/:uuid?/:loom?/:page?'
                    component={() => <App {...props} />}
                />
            </HashRouter>
        </CookiesProvider>
    );
});

const renderApp = () => {
    render(
        <Provider store={store}>
            <ConnectedApp />
        </Provider>,
        document.getElementById('scope')
    );
};

renderApp();
