import React from 'react';
import { Grid, Input, Icon, Tab } from 'semantic-ui-react';

import { LassoSelection } from './model';

import { BackendAPI } from '../common/API';
import ClusterOverlapsTable from '../common/ClusterOverlapsTable';

type LassoSelectionPaneProps = {
    idx: number;
    setModalID: (modalID: string) => void;
} & LassoSelection;

export class LassoSelectionPane extends React.Component<LassoSelectionPaneProps> {
    constructor(props: LassoSelectionPaneProps) {
        super(props);
    }

    toggleLassoSelection(id) {
        BackendAPI.toggleLassoSelection(id);
    }

    removeLassoSelection(id) {
        BackendAPI.removeViewerSelection(id);
    }

    render() {
        const { id, idx, points, color, selected, clusterOverlaps } =
            this.props;

        return (
            <Tab.Pane
                attached={false}
                style={{ textAlign: 'center' }}
                key={idx}>
                <Grid>
                    <Grid.Row columns={3} key={idx} className='selectionRow'>
                        <Grid.Column style={{ whiteSpace: 'unset' }}>
                            {`Selection ${id + 1} (${points.length} cells)`}
                        </Grid.Column>
                        <Grid.Column>
                            <Input
                                size='mini'
                                style={{ width: 75, height: 15 }}
                                label={{
                                    style: {
                                        backgroundColor: '#' + color,
                                    },
                                }}
                                labelPosition='right'
                                placeholder={'#' + color}
                                disabled
                            />
                        </Grid.Column>
                        <Grid.Column>
                            <Icon
                                name='eye'
                                title='toggle show/hide selection'
                                onClick={() => this.toggleLassoSelection(id)}
                                style={{
                                    display: 'inline',
                                    opacity: selected ? 1 : 0.5,
                                }}
                                className='pointer'
                            />
                            &nbsp;
                            <Icon
                                name='trash'
                                title='remove this selection'
                                style={{ display: 'inline' }}
                                onClick={() => this.removeLassoSelection(idx)}
                                className='pointer'
                            />
                            &nbsp;
                            <Icon
                                name='search'
                                title='show metadata for this selection'
                                style={{ display: 'inline' }}
                                onClick={() => {
                                    // TODO: fire redux action
                                    this.props.setModalID(idx.toString());
                                }}
                                className='pointer'
                            />
                        </Grid.Column>
                    </Grid.Row>
                    <Grid.Row>
                        <Grid.Column>
                            {clusterOverlaps ? (
                                <ClusterOverlapsTable
                                    clusterOverlaps={clusterOverlaps}
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
    }
}
