/**
 * Happy path routing for the main application.
 */

import React from 'react';
import { Route, Redirect, Switch, useLocation } from 'react-router-dom';

import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import {
    About,
    Annotations,
    Compare,
    Dataset,
    Gene,
    Regulon,
    Tutorial,
    Welcome,
} from './pages';

const validateSessionID = (name: string): string | null => {
    const allowedChars = /^[*\-0-9A-Za-z]+$/gi;
    if (allowedChars.test(name)) {
        return name;
    }

    return null;
};

export const Main: React.FC<{}> = () => {
    const metadata = null;

    // TODO: sessions and permalinks are deprecated. To be removed
    const loc = useLocation();
    if (loc.hash.startsWith('#/permalink/')) {
        console.log('Is a permalink');
        const session = validateSessionID(loc.hash.substring(12));
        return <Redirect to={`/legacy/restore/${session}`} />; // nosemgrep: typescript.react.security.audit.react-router-redirect.react-router-redirect
    } else if (loc.hash.length > 0) {
        console.log('Is a legacy session');
        const session = validateSessionID(loc.hash.substring(2));
        return <Redirect to={`/legacy/${session}`} />; // nosemgrep: typescript.react.security.audit.react-router-redirect.react-router-redirect
    }

    return (
        <React.StrictMode>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'max-content 1fr',
                    gridTemplateRows: 'max-content 1fr',
                    marginTop: 0,
                    flexGrow: 1,
                    height: '100vh',
                }}>
                <div
                    style={{ height: 'max-content', gridColumn: '1 / span 2' }}>
                    <AppHeader />
                </div>
                <div
                    style={{
                        width: 'max-content',
                        height: '100%',
                        gridColumn: 1,
                    }}>
                    <Sidebar />
                </div>
                <div style={{ gridColumn: 2, height: '100%' }}>
                    <Switch>
                        <Route exact path='/welcome' component={Welcome} />
                        <Route exact path='/tutorial' component={Tutorial} />
                        <Route exact path='/about' component={About} />
                        <Route exact path='/dataset' component={Dataset} />
                        <Route exact path='/gene' component={Gene} />
                        <Route exact path='/regulon' component={Regulon} />
                        <Route
                            exact
                            path='/annotations'
                            component={Annotations}
                        />
                        <Route exact path='/compare'>
                            <Compare metadata={metadata} />
                        </Route>
                        <Route path='/'>
                            <Redirect to='/welcome' />
                        </Route>
                    </Switch>
                </div>
            </div>
        </React.StrictMode>
    );
};
