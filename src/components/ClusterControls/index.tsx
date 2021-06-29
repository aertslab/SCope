import React from 'react';
import { connect } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { withCookies, ReactCookieProps } from 'react-cookie';
import { Grid, Icon, Button } from 'semantic-ui-react';

import { BackendAPI } from '../common/API';
import CollaborativeAnnotation from '../common/CollaborativeAnnotation';
import UpdateClusterDescriptionInput from './UpdateClusterDescriptionInput';

type ClusterControlsProps = {
    featureIndex: number;
    feature: any;
} & RouteComponentProps<{ page: string }> &
    ReactCookieProps;

const ClusterControls: React.FC<ClusterControlsProps> = (props) => {
    const gotoNextCluster = (direction: string) => {
        const {
            featureIndex,
            feature,
            match: {
                params: { page },
            },
        } = props;

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

    const { featureIndex, feature, cookies, match } = props;

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
                <CollaborativeAnnotation
                    feature={feature}
                    id={featureIndex}
                    cookies={cookies} // FIXME: temporary hack until CollaborativeAnnotation is converted to .tsx
                    match={match} // FIXME: temporary hack until CollaborativeAnnotation is converted to .tsx
                />
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

const mapStateToProps = (state) => {
    return {
        cookieConsent: state['main'].cookieConsent,
    };
};

export default connect(mapStateToProps)(
    withCookies(withRouter(ClusterControls))
);
