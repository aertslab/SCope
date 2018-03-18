import _ from 'lodash'
import React, { Component } from 'react'
import { Grid } from 'semantic-ui-react'
import FeatureSearchBox from '../common/FeatureSearchBox'
import { BackendAPI } from '../common/API'
import Viewer from '../common/Viewer'
import ViewerSidebar from '../common/ViewerSidebar'
import ViewerToolbar from '../common/ViewerToolbar'
import Histogram from '../common/Histogram'

export default class Regulon extends Component {

    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            activeFeatures: BackendAPI.getActiveFeatures(),
            regulonMetadata: [],
            sidebar: BackendAPI.getSidebarVisible(),
            colors: BackendAPI.getColors()
        };
        this.activeLoomListener = (loom, metadata, coordinates) => {
            this.setState({activeLoom: loom, activeCoordinates: coordinates});
        };
        this.activeFeaturesListener = (features, featureID) => {
            this.setState({activeFeatures: features});
        };
        this.sidebarVisibleListener = (state) => {
            this.setState({sidebar: state});
            this.forceUpdate();
        }
        this.height = (window.innerHeight - 160) / 4;
    }

    render() {
        const { activeLoom, activeCoordinates, activeFeatures, colors, geneFeatures, sidebar } = this.state;
        let featureSearch = _.times(3, i => (
            <Grid.Column key={i}  width={sidebar ? 4 : 5}>
                <FeatureSearchBox field={i} color={colors[i]} type="regulon" locked="1" value={activeFeatures[i] ? activeFeatures[i].feature : ''} />
            </Grid.Column>
        ));
        let featureThreshold = _.times(3, i => (
            <Grid.Column key={i} width={sidebar ? 4 : 5}>
                <Histogram field={i} height={this.height - 50} color={colors[i]} loomFile={activeLoom} feature={activeFeatures[i]} onThresholdChange={this.onThresholdChange.bind(this)} />
            </Grid.Column>
        ));

        if (!activeLoom) return (
            <div>
                Select the dataset to be analyzed
            </div>
        )

        return (
            <Grid>
                <Grid.Row columns="3">
                    {featureSearch}
                </Grid.Row>
                <Grid.Row columns="3">
                    {featureThreshold}
                </Grid.Row>
                <Grid.Row columns="4">
                    <Grid.Column width={1}>
                        <ViewerToolbar />
                    </Grid.Column>
                    <Grid.Column width={sidebar ? 6 : 7}>
                        <b>Regulon AUC values</b>
                        <Viewer 
                            name="reg" 
                            height={3 * this.height - 15} 
                            loomFile={activeLoom} 
                            activeFeatures={activeFeatures} 
                            activeCoordinates={activeCoordinates}
                            scale={true} 
                        />
                    </Grid.Column>
                    <Grid.Column width={sidebar ? 4 : 5}>
                        <Grid>
                            <Grid.Row>
                                <Grid.Column>
                                    <b>Cells passing thresholds</b>
                                    <Viewer 
                                        name="auc" 
                                        height={3 * this.height / 2 - 15} 
                                        loomFile={activeLoom} 
                                        activeFeatures={activeFeatures}                             
                                        activeCoordinates={activeCoordinates} 
                                        thresholds={true} 
                                    />
                                </Grid.Column>
                            </Grid.Row>
                            <Grid.Row>
                                <Grid.Column>
                                    <b>Expression levels</b>
                                    <Viewer 
                                        name="expr" 
                                        height={3 * this.height / 2 - 15} 
                                        loomFile={activeLoom} 
                                        activeFeatures={activeFeatures} 
                                        activeCoordinates={activeCoordinates} 
                                        scale={true} 
                                        genes={true}
                                        settings={true} 
                                        customScale={true} 
                                    />
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                    </Grid.Column>
                    <Grid.Column width={3}>
                        <ViewerSidebar  onActiveFeaturesChange={(features, id) => {
                            this.setState({activeFeatures: features});
                        }} />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }

    componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
        BackendAPI.onActiveFeaturesChange('regulon', this.activeFeaturesListener);
        BackendAPI.onSidebarVisibleChange(this.sidebarVisibleListener);
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeActiveFeaturesChange('regulon', this.activeFeaturesListener);
        BackendAPI.removeSidebarVisibleChange(this.sidebarVisibleListener)
    }

    onThresholdChange(idx, threshold) {
        BackendAPI.setFeatureThreshold(idx, threshold);
    }

}
