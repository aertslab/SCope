/**
 * Happy path routing for the main application.
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Route, Redirect, useLocation } from 'react-router-dom';

import { Segment } from 'semantic-ui-react';

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

export const SessionLoading: React.FC = () => {
    return (
        <Segment vertical textAlign='center' className='parentView'>
            <h1>SCope</h1>
        </Segment>
    );
};

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
    console.log(loc);
    if (loc.hash.startsWith('#/permalink/')) {
        console.log('Is a permalink');
        return <Redirect to={'/legacy/restore/' + loc.hash.substring(12)} />;
    } else if (loc.hash.length > 0) {
        return <Redirect to={'/legacy/' + loc.hash.substring(1)} />;
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
                {/* <Route path='/:uuid/:loom?/welcome' component={Welcome} />
                    <Route path='/:uuid/:loom?/dataset' component={Dataset} />
                    <Route path='/:uuid/:loom?/gene' component={Gene} />
                    <Route path='/:uuid/:loom?/regulon' component={Regulon} />
                    <Route
                    path='/:uuid/:loom?/annotations'
                    component={Annotations}
                    />
                    <Route path='/:uuid/:loom?/compare'>
                    <Compare metadata={metadata} />
                    </Route>
                    <Route path='/:uuid/:loom?/tutorial' component={Tutorial} />
                    <Route path='/:uuid/:loom?/about' component={About} /> */}
                <div style={{ gridColumn: 2, height: '100%' }}>
                    <Route exact path='/welcome' component={Welcome} />
                </div>
            </div>
        </React.StrictMode>
    );
};
