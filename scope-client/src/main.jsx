import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import 'semantic-ui-css/semantic.min.css';
import './css/header.css';
import './css/sidebar.css';
import './css/viewer.css';
import './css/features.css';
import { BrowserRouter } from 'react-router-dom'
import { AppContainer } from 'react-hot-loader'

const renderApp = () => {
    ReactDOM.render((
        <AppContainer>
            <BrowserRouter>
                <App/>
            </BrowserRouter>
        </AppContainer>
    ), document.getElementById('scope'));
}

if(module.hot) {
    module.hot.accept('./components/App', renderApp)
}

renderApp()

