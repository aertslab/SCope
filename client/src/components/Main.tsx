/**
 * Happy path routing for the main application.
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Route } from 'react-router-dom';

import { Segment, Header, Grid } from 'semantic-ui-react';
import { Cookies } from 'react-cookie';

import { RootState } from '../redux/reducers';
import { SessionMode } from '../redux/types';

import AppHeader from './AppHeader';
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
    sessionMode: SessionMode;
};

export const Main: React.FC<MainProps> = (props: MainProps) => {
    const state: MainState = useSelector<RootState, MainState>(
        (root: RootState) => {
            return {
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
            <Grid
                stretched
                columns={2}
                style={{
                    display: 'flex',
                    height: '100vh',
                }}>
                <Grid.Column
                    style={{
                        width: 'max-content',
                    }}
                    stretched>
                    <AppSidebar
                        visible={true}
                        onMetadataChange={setMetadata}
                        sessionMode={state.sessionMode}
                    />
                </Grid.Column>
                <Grid.Column
                    style={{
                        flexGrow: 100,
                    }}
                    stretched>
                    <Route path='/:uuid/:loom?/welcome' component={Welcome} />
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
                    <Route path='/:uuid/:loom?/about' component={About} />
                </Grid.Column>
            </Grid>
        </React.Fragment>
    );
};
