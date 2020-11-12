/**
 * Happy path routing for the main application.
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { withRouter, Route } from 'react-router-dom';

import { Segment, Header, Sidebar } from 'semantic-ui-react';
import { Cookies } from 'react-cookie';

import { RootState } from '../redux/reducers';
import { SessionMode } from '../redux/types';

import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import {
    About,
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
            <Header as='h1'>SCope</Header>
        </Segment>
    );
};

type MainProps = {
    loaded: boolean;
    timeout: string;
    cookies: Cookies;
};

type MainState = {
    sidebarIsVisible: boolean;
    sessionMode: SessionMode;
};

export const Main: React.FC<MainProps> = (props: MainProps) => {
    const state: MainState = useSelector<RootState, MainState>(
        (root: RootState) => {
            return {
                sidebarIsVisible: root.main.sidebarIsVisible,
                sessionMode: root.main.sessionMode,
            };
        }
    );

    const [metadata, setMetadata] = useState(null);

    return (
        <React.Fragment>
            <AppHeader
                loaded={props.loaded}
                timeout={props.timeout}
                cookies={props.cookies}
            />
            <Sidebar.Pushable>
                <AppSidebar
                    visible={state.sidebarIsVisible}
                    onMetadataChange={setMetadata}
                    sessionMode={state.sessionMode}
                />
                <Sidebar.Pusher style={{ width: '100%' }}>
                    <Route path='/:uuid/:loom?/welcome' component={Welcome} />
                    <Route path='/:uuid/:loom?/dataset' component={Dataset} />
                    <Route path='/:uuid/:loom?/gene' component={Gene} />
                    <Route path='/:uuid/:loom?/regulon' component={Regulon} />
                    <Route path='/:uuid/:loom?/compare'>
                        <Compare metadata={metadata} />
                    </Route>
                    <Route path='/:uuid/:loom?/tutorial' component={Tutorial} />
                    <Route path='/:uuid/:loom?/about' component={About} />
                </Sidebar.Pusher>
            </Sidebar.Pushable>
        </React.Fragment>
    );
};
