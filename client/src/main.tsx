import * as React from 'react';
import { render } from 'react-dom';
import App from './components/App';
import 'semantic-ui-css/semantic.min.css';
import { HashRouter, Route } from 'react-router-dom';
import { CookiesProvider } from 'react-cookie';
import { Provider } from 'react-redux';

import configureStore from './redux/store';
import './css/styles.css';
import './css/header.css';
import './css/sidebar.css';
import './css/viewer.css';
import './css/features.css';

const store = configureStore({});

const MainApp: React.FC<{}> = () => {
    return (
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
};

const renderApp = () => {
    render(
        <Provider store={store}>
            <CookiesProvider>
                <HashRouter>
                    <Route path='/:uuid?/:loom?/:page?' component={MainApp} />
                </HashRouter>
            </CookiesProvider>
        </Provider>,
        document.getElementById('scope')
    );
};

renderApp();
