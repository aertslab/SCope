/**
 * Happy path routing for the main application.
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Route, Redirect, Switch, useLocation } from 'react-router-dom';

import { RootState } from '../redux/reducers';
import { SessionMode } from '../redux/types';

import { AppHeader } from './AppHeader';
import AppSidebar from './AppSidebar';
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

type MainState = {
    sessionMode: SessionMode;
};

export const Main: React.FC<{}> = () => {
    const state: MainState = useSelector<RootState, MainState>(
        (root: RootState) => {
            return {
                sessionMode: root.main.sessionMode,
            };
        }
    );

    const [metadata, setMetadata] = useState(null);

    const loc = useLocation();
    if (loc.hash.startsWith('#/permalink/')) {
        console.log('Is a permalink');
        return <Redirect to={'/legacy/restore/' + loc.hash.substring(12)} />;
    } else if (loc.hash.length > 0) {
        console.log('Is a legacy session');
        return <Redirect to={'/legacy/' + loc.hash.substring(2)} />;
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
                    <AppSidebar
                        visible={true}
                        onMetadataChange={setMetadata}
                        sessionMode={state.sessionMode}
                    />
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
