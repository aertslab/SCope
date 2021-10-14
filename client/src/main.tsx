import * as React from 'react';
import { render } from 'react-dom';
import 'semantic-ui-css/semantic.min.css';
import { BrowserRouter, HashRouter, Route, Switch } from 'react-router-dom';
import { Provider } from 'react-redux';

import configureStore from './redux/store';

import App from './components/App';
import { LoginRedirect } from './components/Auth';

import './css/styles.css';
import './css/header.css';
import './css/sidebar.css';
import './css/viewer.css';
import './css/features.css';

declare const LOGIN_REDIRECT: string;

const store = configureStore({});

const renderApp = () => {
    render(
        <Provider store={store}>
            <BrowserRouter>
                <Switch>
                    <Route path={LOGIN_REDIRECT} component={LoginRedirect} />
                    <Route path='/'>
                        <HashRouter>
                            <Route
                                path='/:uuid?/:loom?/:page?'
                                component={App}
                            />
                        </HashRouter>
                    </Route>
                </Switch>
            </BrowserRouter>
        </Provider>,
        document.getElementById('scope')
    );
};

renderApp();
