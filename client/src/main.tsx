import * as React from 'react';
import ReactDOM from 'react-dom';
import 'semantic-ui-css/semantic.min.css';
import {
    BrowserRouter,
    Route,
    Switch,
    Redirect,
} from 'react-router-dom';
import { Provider } from 'react-redux';

import configureStore from './redux/store';

import { Main } from './components/Main';
import { LoginRedirect } from './components/Auth';
import * as Legacy from './components/Legacy';

import './css/styles.css';
import './css/header.css';
import './css/sidebar.css';
import './css/viewer.css';
import './css/features.css';

declare const LOGIN_REDIRECT: string;

const store = configureStore({});

const LegacySession = () => {
    console.log('Legacy session...');
    return <Redirect to='/welcome' />;
};

ReactDOM.render(
    <Provider store={store}>
        <BrowserRouter>
            <Switch>
                <Route path={LOGIN_REDIRECT} component={LoginRedirect} />
                <Route
                    path='/legacy/restore/:sessiondata'
                    component={Legacy.PermalinkRestore}
                />
                <Route
                    path='/legacy/:uuid/:loom?/:page?'
                    component={LegacySession}
                />
                <Route path='/' component={Main} />
            </Switch>
        </BrowserRouter>
    </Provider>,
    document.getElementById('scope')
);
