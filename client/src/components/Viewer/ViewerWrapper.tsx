import React from 'react';
import { useSelector } from 'react-redux';

import { RootState } from '../../redux/reducers';

import { State } from './model';
import * as Select from './selectors';

export const ViewerWrapper: React.FC<{}> = () => {
    const active = useSelector<RootState, State>(Select.active);

    return (
        <div>
            <div>{active?.project || 'No selected project'}</div>
            <div>{active?.dataset || 'No selected dataset'}</div>
        </div>
    );
};
