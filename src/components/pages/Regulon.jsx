import React, { Component } from 'react';
import { Segment, Grid } from 'semantic-ui-react';

import './pages.css';

import { FEATURE_COLOURS } from '../constants';

import Search from '../Search';
import { BackendAPI } from '../common/API';
import Viewer from '../common/Viewer';
import ViewerSidebar from '../common/ViewerSidebar';
import ViewerToolbar from '../common/ViewerToolbar';
import Histogram from '../common/Histogram';

export default class Regulon extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            activeFeatures: BackendAPI.getActiveFeatures(),
        };
        this.activeLoomListener = (loom, metadata, coordinates) => {
            this.setState({ activeLoom: loom, activeCoordinates: coordinates });
        };
        this.activeFeaturesListener = (features, featureID) => {
            this.setState({ activeFeatures: features });
        };
    }

    render() {
        const { activeLoom, activeCoordinates, activeFeatures, geneFeatures } =
            this.state;
        let featureThreshold = [1, 2, 3].map((i) => (
            <Grid.Column key={i} className='flexDisplay' stretched>
                <Histogram
                    field={i}
                    color={FEATURE_COLOURS[i]}
                    loomFile={activeLoom}
                    feature={activeFeatures[i]}
                    onThresholdChange={this.onThresholdChange.bind(this)}
                />
            </Grid.Column>
        ));

        if (!activeLoom) {
            return <div>Select the dataset to be analyzed</div>;
        }

        return (
            <div className='appPage'>
                <Search.FeatureSearchGroup
                    filter='regulon'
                    identifier='regulon-page'
                />

                <Grid className='flexDisplay'>
                    <Grid.Row columns='3' centered>
                        {featureThreshold}
                        <Grid.Column>&nbsp;</Grid.Column>
                    </Grid.Row>
                    <Grid.Row
                        columns='4'
                        stretched
                        className='viewerFlex flexRow'>
                        <Grid.Column width={1}>
                            <ViewerToolbar location={this.props.location} />
                        </Grid.Column>
                        <Grid.Column stretched className='flexDouble'>
                            <b className='noStretch'>Regulon AUC values</b>
                            <Viewer
                                name='reg'
                                loomFile={activeLoom}
                                activeFeatures={activeFeatures}
                                activeCoordinates={activeCoordinates}
                                scale={true}
                                location={this.props.location}
                            />
                        </Grid.Column>
                        <Grid.Column stretched>
                            <Segment vertical stretched className='flexDisplay'>
                                <b className='noStretch'>
                                    Cells passing thresholds
                                </b>
                                <Viewer
                                    name='auc'
                                    loomFile={activeLoom}
                                    activeFeatures={activeFeatures}
                                    activeCoordinates={activeCoordinates}
                                    thresholds={true}
                                    location={this.props.location}
                                />
                            </Segment>
                            <Segment vertical stretched className='flexDisplay'>
                                <b className='noStretch'>Expression levels</b>
                                <Viewer
                                    name='expr'
                                    loomFile={activeLoom}
                                    activeFeatures={activeFeatures}
                                    activeCoordinates={activeCoordinates}
                                    scale={true}
                                    genes={true}
                                    settings={true}
                                    customScale={true}
                                    location={this.props.location}
                                />
                            </Segment>
                        </Grid.Column>
                        <Grid.Column width={4}>
                            <ViewerSidebar
                                onActiveFeaturesChange={(features, id) => {
                                    this.setState({ activeFeatures: features });
                                }}
                                identifier='regulon-page'
                            />
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            </div>
        );
    }

    UNSAFE_componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
        BackendAPI.onActiveFeaturesChange(
            'regulon',
            this.activeFeaturesListener
        );
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeActiveFeaturesChange(
            'regulon',
            this.activeFeaturesListener
        );
    }

    onThresholdChange(idx, threshold) {
        BackendAPI.setFeatureThreshold(idx, threshold);
    }
}
