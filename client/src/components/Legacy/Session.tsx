import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export const Session: React.FC<{}> = () => {
    const { uuid, loom, page } = useParams();
    const valid = [
        'welcome',
        'tutorial',
        'about',
        'dataset',
        'gene',
        'regulon',
        'annotations',
        'compare',
    ];
    const redirect = valid.includes(`${page}`) ? `${page}` : 'welcome';
    console.log(
        `Legacy session with UUID: ${uuid}, Loom: ${loom}, on page: ${page} -> ${redirect}`
    );
    return <Navigate to={`/${redirect}`} replace />; // nosemgrep: typescript.react.security.audit.react-router-redirect.react-router-redirect
};
