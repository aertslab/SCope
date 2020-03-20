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

const renderApp = () => {
    render(
        <CookiesProvider>
            <HashRouter>
                <Route path='/:uuid?/:loom?/:page?' component={App} />
            </HashRouter>
        </CookiesProvider>,
        document.getElementById('scope')
    );
};

renderApp();

