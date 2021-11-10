import React from 'react';
import { Redirect, useParams } from 'react-router-dom';

export const Session: React.FC<{}> = () => {
    const { uuid, loom, page } =
        useParams<{ uuid?: string; loom?: string; page?: string }>();
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
    return <Redirect to={`/${redirect}`} />; // nosemgrep: typescript.react.security.audit.react-router-redirect.react-router-redirect
};
