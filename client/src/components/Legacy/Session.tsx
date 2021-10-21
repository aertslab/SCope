import React from 'react';
import { Redirect, useParams } from 'react-router-dom';

export const Session: React.FC<{}> = () => {
    const { uuid, loom, page } =
        useParams<{ uuid?: string; loom?: string; page?: string }>();
    console.log(
        `Legacy session with UUID: ${uuid}, Loom: ${loom}, on page: ${page}`
    );
    return <Redirect to={'/' + page} />;
};
