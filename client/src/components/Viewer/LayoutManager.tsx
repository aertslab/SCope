import React, { useRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as R from 'ramda';
import { Button, Icon } from 'semantic-ui-react';

import { RootState } from '../../redux/reducers';

import { Container } from './model';
import * as Select from './selectors';
import * as Action from './actions';

const Placeholder: React.FC<{}> = () => {
    return <div>Placeholder</div>;
};

type WrapperState = {
    views: Array<Container>;
    rows: number;
    cols: number;
};

export const LayoutManager: React.FC<{}> = () => {
    const container = useRef(null);
    const dispatch = useDispatch();
    const state = useSelector<RootState, WrapperState>((root: RootState) => {
        const [rows, cols] = Select.shape(root);
        const views = Select.viewNodes(root);
        return {
            views,
            rows,
            cols,
        };
    });

    const resizeContainer = () => {
        dispatch(
            Action.layout({
                width: (container.current as HTMLDivElement | null)
                    ?.clientWidth,
                height: (container.current as HTMLDivElement | null)
                    ?.clientHeight,
            })
        );
    };

    useEffect(() => {
        resizeContainer();
        window.addEventListener('resize', resizeContainer);

        return () => window.removeEventListener('resize', resizeContainer);
    }, []);

    return (
        <div
            ref={container}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
            }}></div>
    );
};

/*
   {R.flatten(state.grid).map((vid) => {
   if (vid === undefined) {
   return <div>Empty</div>;
   } else {
   const viewer = R.prop(vid, state.viewers);
   if (viewer === undefined) {
   return <div>Empty</div>;
   } else {
   return (
   <Placeholder
   dataset={viewer.dataset}
   project={viewer.project}
   />
   );
   }
   }
   })}

   <div
   style={{
   display: 'flex',
   placeItems: 'center',
   gridArea: 'addColumn',
   }}>
   <Button
   icon
   color='green'
   style={{ height: '100%' }}
   onClick={() => dispatch(Action.addViewerCol())}>
   <Icon name='plus' />
   </Button>
   </div>

   <div
   style={{
   display: 'flex',
   placeItems: 'center',
   flexDirection: 'column',
   gridArea: 'addRow',
   }}>
   <Button
   icon
   fluid
   color='green'
   onClick={() => dispatch(Action.addViewerRow())}>
   <Icon name='plus' />
   </Button>
   </div>

 */
