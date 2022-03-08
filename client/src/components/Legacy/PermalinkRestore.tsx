import React, { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import * as Action from './actions';

export const PermalinkRestore: React.FC<{}> = () => {
    const dispatch = useDispatch();
    const { sessiondata } = useParams();

    console.log('PermalinkRestore:', sessiondata);

    useEffect(() => {
        if (sessiondata !== undefined) {
            dispatch(Action.decodeSessionData(sessiondata));
        }
    });

    return <Navigate to='/welcome' replace />;
};
