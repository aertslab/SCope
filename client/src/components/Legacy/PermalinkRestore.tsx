import React, { useEffect } from 'react';
import { Redirect, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import * as Action from './actions';

export const PermalinkRestore: React.FC<{}> = () => {
    const dispatch = useDispatch();
    const { sessiondata } = useParams<{ sessiondata: string }>();

    console.log('PermalinkRestore:', sessiondata);

    useEffect(() => {
        dispatch(Action.decodeSessionData(sessiondata));
    });

    return <Redirect to='/welcome' />;
};
