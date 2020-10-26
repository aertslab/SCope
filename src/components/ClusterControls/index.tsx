import React from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Header, Grid, Icon, Button } from 'semantic-ui-react';

import { BackendAPI } from '../common/API';
import CollaborativeAnnotation from '../common/CollaborativeAnnotation';
import UpdateClusterDescriptionInput from './UpdateClusterDescriptionInput';

type ClusterControlsProps = {
    featureIndex: number;
    feature: any;
} & RouteComponentProps<{ page: string }>;

class ClusterControls extends React.Component<ClusterControlsProps> {
    constructor(props: ClusterControlsProps) {
        super(props);
    }

    gotoNextCluster = (direction: string) => {
        const {
            featureIndex,
            feature,
            match: {
                params: { page },
            },
        } = this.props;
        console.log(feature);

        BackendAPI.getNextCluster(
            feature.metadata['clusteringID'],
            feature.metadata['clusterID'],
            direction,
            (response) => {
                BackendAPI.updateFeature(
                    featureIndex,
                    response.featureType[0],
                    response.feature[0],
                    response.featureType[0],
                    response.featureDescription[0],
                    page,
                    (e) => {}
                );
            }
        );
    };

    render() {
        const { featureIndex, feature } = this.props;

        return (
            <Grid>
                <Grid.Row centered>
                    <Header as='h3' textAlign='center'>
                        Cluster Controls
                    </Header>
                </Grid.Row>
                <Grid.Row>
                    <UpdateClusterDescriptionInput
                        featureIndex={featureIndex}
                        feature={feature}
                    />
                </Grid.Row>
                <Grid.Row>
                    <Button
                        onClick={() => this.gotoNextCluster('previous')}
                        className='change-cluster-button'>
                        {<Icon name='long arrow alternate left' />}
                        Previous
                    </Button>
                    <CollaborativeAnnotation
                        feature={feature}
                        id={featureIndex}
                    />
                    <Button
                        onClick={() => this.gotoNextCluster('next')}
                        className='change-cluster-button'>
                        Next
                        {<Icon name='long arrow alternate right' />}
                    </Button>
                </Grid.Row>
            </Grid>
        );
    }
}

export default withRouter(ClusterControls);
