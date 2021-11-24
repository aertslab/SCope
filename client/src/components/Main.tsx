/**
 * Happy path routing for the main application.
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';

const validateSessionID = (name: string): string | null => {
    const allowedChars = /^[*\-0-9A-Za-z]+$/gi;
    if (allowedChars.test(name)) {
        return name;
    }

    return null;
};

export const Main: React.FC<{}> = () => {
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
                    <Sidebar />
                </div>
                <div style={{ gridColumn: 2, height: '100%' }}>
                    <Outlet />
                </div>
            </div>
        </React.StrictMode>
    );
};
