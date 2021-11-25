import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as R from 'ramda';
import { Button, Icon } from 'semantic-ui-react';

import { RootState } from '../../redux/reducers';

import { ViewerId, ViewerInfo, ViewerMap } from './model';
import * as Select from './selectors';
import * as Action from './actions';

const Placeholder: React.FC<ViewerInfo> = (props: ViewerInfo) => {
    return (
        <div>
            {props.project}, {props.dataset}
        </div>
    );
};

type WrapperState = {
    viewers: ViewerMap;
    grid: Array<Array<ViewerId | undefined>>;
    rows: number;
    cols: number;
};

export const ViewerWrapper: React.FC<{}> = () => {
    const dispatch = useDispatch();
    const state = useSelector<RootState, WrapperState>((root: RootState) => {
        const [rows, cols] = Select.shape(root);
        const viewers = Select.viewers(root);
        const grid = Select.grid(root);
        return { viewers, grid, rows, cols };
    });

    const templateAreas = R.concat(
        R.range(0, state.rows).map(() => {
            const plotArea = R.repeat('.', state.cols).join(' ');
            return `'${plotArea} addColumn'`;
        }),
        [`'${R.repeat('addRow', state.cols).join(' ')} .'`]
    ).join('\n');

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${state.cols}, 1fr) 40px`,
                gridTemplateRows: `repeat(${state.rows}, 1fr) 40px`,
                gridTemplateAreas: templateAreas,
                width: '100%',
                height: '100%',
            }}>
            {R.flatten(state.grid).map((vid) => {
                if (vid === undefined) {
                    return <div>Empty</div>;
                } else {
                    const viewer = state.viewers[vid];
                    return (
                        <Placeholder
                            dataset={viewer.dataset}
                            project={viewer.project}
                        />
                    );
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
                    onClick={() => dispatch(Action.addViewerRow())}>
                    <Icon name='plus' />
                </Button>
            </div>
        </div>
    );
};
