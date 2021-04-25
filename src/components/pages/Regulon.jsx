import _ from 'lodash';
import React, { Component } from 'react';
import { Segment, Grid } from 'semantic-ui-react';
import FeatureSearchBox from '../common/FeatureSearchBox';
import { BackendAPI } from '../common/API';
import PIXIViewer from '../common/Viewer';
import ThreeViewer from '../common/ThreeViewer';
import ViewerSidebar from '../common/ViewerSidebar';
import ViewerToolbar from '../common/ViewerToolbar';
import Histogram from '../common/Histogram';

export default class Regulon extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeViewer: BackendAPI.getActiveViewer(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            activeFeatures: BackendAPI.getActiveFeatures(),
            sidebar: BackendAPI.getSidebarVisible(),
            colors: BackendAPI.getColors(),
        };
        this.activeViewerListener = (viewer) => {
            this.setState({
                activeViewer: viewer,
            });
        };

        this.viewers = { PIXI: PIXIViewer, threejs: ThreeViewer };

        this.activeLoomListener = (loom, metadata, coordinates) => {
            this.setState({ activeLoom: loom, activeCoordinates: coordinates });
        };
        this.activeFeaturesListener = (features, featureID) => {
            this.setState({ activeFeatures: features });
        };
        this.sidebarVisibleListener = (state) => {
            this.setState({ sidebar: state });
            this.forceUpdate();
        };
    }

    render() {
        const {
            activeLoom,
            activeCoordinates,
            activeFeatures,
            colors,
            geneFeatures,
            sidebar,
            activeViewer,
        } = this.state;
        const Viewer = this.viewers[activeViewer];
        let featureSearch = _.times(3, (i) => (
            <Grid.Column key={i}>
                <FeatureSearchBox
                    field={i}
                    color={colors[i]}
                    type='regulon'
                    selectLocked={true}
                    value={activeFeatures[i] ? activeFeatures[i].feature : ''}
                />
            </Grid.Column>
        ));
        let featureThreshold = _.times(3, (i) => (
            <Grid.Column key={i} className='flexDisplay' stretched>
                <Histogram
                    field={i}
                    color={colors[i]}
                    loomFile={activeLoom}
                    feature={activeFeatures[i]}
                    onThresholdChange={this.onThresholdChange.bind(this)}
                />
            </Grid.Column>
        ));

        if (!activeLoom) return <div>Select the dataset to be analyzed</div>;

        return (
            <Grid className='flexDisplay'>
                <Grid.Row columns='4' centered>
                    {featureSearch}
                    <Grid.Column>&nbsp;</Grid.Column>
                </Grid.Row>
                <Grid.Row columns='4' centered>
                    {featureThreshold}
                    <Grid.Column>&nbsp;</Grid.Column>
                </Grid.Row>
                <Grid.Row columns='4' stretched className='viewerFlex flexRow'>
                    <Grid.Column width={1}>
                        <ViewerToolbar />
                    </Grid.Column>
                    <Grid.Column stretched className='flexDouble'>
                        <b className='noStretch'>Regulon AUC values</b>
                        <Viewer
                            name='reg'
                            loomFile={activeLoom}
                            activeFeatures={activeFeatures}
                            activeCoordinates={activeCoordinates}
                            scale={true}
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
                            />
                        </Segment>
                    </Grid.Column>
                    <Grid.Column width={4}>
                        <ViewerSidebar
                            onActiveFeaturesChange={(features, id) => {
                                this.setState({ activeFeatures: features });
                            }}
                        />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }

    UNSAFE_componentWillMount() {
        BackendAPI.onActiveViewerChange(this.activeViewerListener);
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
        BackendAPI.onActiveFeaturesChange(
            'regulon',
            this.activeFeaturesListener
        );
        BackendAPI.onSidebarVisibleChange(this.sidebarVisibleListener);
    }

    componentWillUnmount() {
        BackendAPI.removeActiveViewerChange(this.activeViewerListener);
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeActiveFeaturesChange(
            'regulon',
            this.activeFeaturesListener
        );
        BackendAPI.removeSidebarVisibleChange(this.sidebarVisibleListener);
    }

    onThresholdChange(idx, threshold) {
        BackendAPI.setFeatureThreshold(idx, threshold);
    }
}
