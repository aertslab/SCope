import * as React from 'react';
import ReactDOM from 'react-dom';
import 'fomantic-ui-css/semantic.min.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';

import configureStore from './redux/store';

import { Main } from './components/Main';
import { LoginRedirect } from './components/Auth';
import * as Legacy from './components/Legacy';
import {
    About,
    Annotations,
    Compare,
    Dataset,
    Gene,
    Regulon,
    Tutorial,
    Welcome,
    Viewer,
} from './components/pages';

import './css/styles.css';
import './css/header.css';
import './css/sidebar.css';
import './css/viewer.css';
import './css/features.css';

declare const LOGIN_REDIRECT: string;

const store = configureStore({});

ReactDOM.render(
    <Provider store={store}>
        <BrowserRouter>
            <Routes>
                <Route path={LOGIN_REDIRECT} element={<LoginRedirect />} />
                <Route
                    path='/legacy/restore/:sessiondata'
                    element={<Legacy.PermalinkRestore />}
                />
                <Route
                    path='/legacy/:uuid/:loom?/:page?'
                    element={<Legacy.Session />}
                />
                <Route path='/' element={<Main />}>
                    <Route path='tutorial' element={<Tutorial />} />
                    <Route path='about' element={<About />} />
                    <Route path='dataset' element={<Dataset />} />
                    <Route path='gene' element={<Gene />} />
                    <Route path='regulon' element={<Regulon />} />
                    <Route path='annotations' element={<Annotations />} />
                    <Route path='viewer' element={<Viewer />} />
                    <Route
                        path='compare'
                        element={<Compare metadata={null} />}
                    />
                    <Route path='/' element={<Welcome />} />
                    <Route
                        path='/welcome'
                        element={<Navigate to='/' replace />}
                    />
                </Route>
            </Routes>
        </BrowserRouter>
    </Provider>,
    document.getElementById('scope')
);
