import React from 'react';
import { Grid, Icon, Button } from 'semantic-ui-react';

import { BackendAPI } from '../common/API';
import CollaborativeAnnotation from '../common/CollaborativeAnnotation';
import UpdateClusterDescriptionInput from './UpdateClusterDescriptionInput';

type ClusterControlsProps = {
    featureIndex: number;
    feature: any;
};

export const ClusterControls: React.FC<ClusterControlsProps> = (props) => {
    const gotoNextCluster = (direction: string) => {
        const { featureIndex, feature } = props;

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
                    null,
                    () => {}
                );
            }
        );
    };

    const { featureIndex, feature } = props;

    return (
        <Grid>
            <Grid.Row>
                <UpdateClusterDescriptionInput
                    featureIndex={featureIndex}
                    feature={feature}
                />
            </Grid.Row>
            <Grid.Row>
                <Button
                    onClick={() => gotoNextCluster('previous')}
                    className='change-cluster-button'>
                    {<Icon name='long arrow alternate left' />}
                    Previous
                </Button>
                <CollaborativeAnnotation feature={feature} id={featureIndex} />
                <Button
                    onClick={() => gotoNextCluster('next')}
                    className='change-cluster-button'>
                    Next
                    {<Icon name='long arrow alternate right' />}
                </Button>
            </Grid.Row>
        </Grid>
    );
};
