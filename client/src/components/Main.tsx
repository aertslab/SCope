/**
 * Happy path routing for the main application.
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/reducers';
import { SessionMode } from '../redux/types';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AppHeader } from './AppHeader';
import AppSidebar from './AppSidebar';
type MainState = {
    sessionMode: SessionMode;
};

const validateSessionID = (name: string): string | null => {
    const allowedChars = /^[*\-0-9A-Za-z]+$/gi;
    if (allowedChars.test(name)) {
        return name;
    }

    return null;
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

    // TODO: sessions and permalinks are deprecated. To be removed
    const loc = useLocation();
    if (loc.hash.startsWith('#/permalink/')) {
        console.log('Is a permalink');
        const session = validateSessionID(loc.hash.substring(12));
        return <Navigate to={`/legacy/restore/${session}`} replace />; // nosemgrep: typescript.react.security.audit.react-router-redirect.react-router-redirect
    } else if (loc.hash.length > 0) {
        console.log('Is a legacy session');
        const session = validateSessionID(loc.hash.substring(2));
        return <Navigate to={`/legacy/${session}`} replace />; // nosemgrep: typescript.react.security.audit.react-router-redirect.react-router-redirect
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
                    <Outlet />
                </div>
            </div>
        </React.StrictMode>
    );
};
