import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Redirect, useLocation } from 'react-router-dom';

import * as Action from './actions';

const LoginRedirect: React.FC<{}> = () => {
    const dispatch = useDispatch();

    const authData = new URLSearchParams(useLocation().search);
    const code: string | null = authData.get('code');
    const state: string | null = authData.get('state');

    useEffect(() => {
        if (code !== null && state !== null) {
            dispatch(Action.requestToken(code, state));
        }
    });

    return <Redirect to='/' />;
};

export { LoginRedirect };
