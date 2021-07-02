import React from 'react';
import { Grid, Input, Icon, Tab } from 'semantic-ui-react';

import { LassoSelection } from './model';

import { BackendAPI } from '../common/API';
import ClusterOverlapsTable from '../common/ClusterOverlapsTable';

type LassoSelectionPaneProps = {
    idx: number;
    setModalID: (_modalID: string) => void;
} & LassoSelection;

export const LassoSelectionPane: React.FC<LassoSelectionPaneProps> = (
    props
) => {
    const toggleLassoSelection = (id) => {
        BackendAPI.toggleLassoSelection(id);
    };

    const removeLassoSelection = (id) => {
        BackendAPI.removeViewerSelection(id);
    };

    return (
        <Tab.Pane
            attached={false}
            style={{ textAlign: 'center' }}
            key={props.idx}>
            <Grid>
                <Grid.Row columns={3} key={props.idx} className='selectionRow'>
                    <Grid.Column style={{ whiteSpace: 'unset' }}>
                        {`Selection ${props.id + 1} (${
                            props.points.length
                        } cells)`}
                    </Grid.Column>
                    <Grid.Column>
                        <Input
                            size='mini'
                            style={{ width: 75, height: 15 }}
                            label={{
                                style: {
                                    backgroundColor: '#' + props.color,
                                },
                            }}
                            labelPosition='right'
                            placeholder={'#' + props.color}
                            disabled
                        />
                    </Grid.Column>
                    <Grid.Column>
                        <Icon
                            name='eye'
                            title='toggle show/hide selection'
                            onClick={() => toggleLassoSelection(props.id)}
                            style={{
                                display: 'inline',
                                opacity: props.selected ? 1 : 0.5,
                            }}
                            className='pointer'
                        />
                        &nbsp;
                        <Icon
                            name='trash'
                            title='remove this selection'
                            style={{ display: 'inline' }}
                            onClick={() => removeLassoSelection(props.idx)}
                            className='pointer'
                        />
                        &nbsp;
                        <Icon
                            name='search'
                            title='show metadata for this selection'
                            style={{ display: 'inline' }}
                            onClick={() => {
                                // TODO: fire redux action
                                props.setModalID(props.idx.toString());
                            }}
                            className='pointer'
                        />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column>
                        {props.clusterOverlaps ? (
                            <ClusterOverlapsTable
                                clusterOverlaps={props.clusterOverlaps}
                            />
                        ) : (
                            ''
                        )}
                    </Grid.Column>
                </Grid.Row>
            </Grid>
            <br />
        </Tab.Pane>
    );
};
