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
            activeFeatures: BackendAPI.getActiveFeatures('regulon'),
            geneFeatures: this.getGeneFeatures(BackendAPI.getActiveFeatures('regulon')),
            thresholds: BackendAPI.getThresholds(),
            sidebar: BackendAPI.getSidebarVisible(),
            colors: ["red", "green", "blue"]
        };
        this.activeLoomListener = (loom, metadata, coordinates) => {
            this.setState({activeLoom: loom, activeCoordinates: coordinates});
        };
        this.activeFeaturesListener = (features, i) => {
            let thresholds = this.state.thresholds;
            let geneFeatures = this.getGeneFeatures(features);
            //if (features[i].threshold) thresholds[i] = features[i].threshold;
            this.setState({activeFeatures: features, thresholds: thresholds, geneFeatures: geneFeatures});
        };
        this.sidebarVisibleListener = (state) => {
            this.setState({sidebar: state});
            this.forceUpdate();
        }
        this.height = (window.innerHeight - 160) / 4;
    }

    render() {
        const { activeLoom, activeCoordinates, activeFeatures, thresholds, colors, geneFeatures, sidebar } = this.state;
        let featureSearch = _.times(3, i => (
            <Grid.Column key={i}  width={sidebar ? 4 : 5}>
                <FeatureSearchBox field={i} color={colors[i]} type="regulon" locked="1" value={activeFeatures[i].value} />
            </Grid.Column>
        ));
        let featureThreshold = _.times(3, i => (
            <Grid.Column key={i} width={sidebar ? 4 : 5}>
                <Histogram field={i} height={this.height - 50} color={colors[i]} loomFile={activeLoom} feature={activeFeatures[i]} onThresholdChange={this.onThresholdChange.bind(this)} value={thresholds[i]} />
            </Grid.Column>
        ));

        return (
            <div>
                <div style={{display: activeLoom == null ? 'block' : 'none'}}>
                    Select the dataset to be analyzed
                </div>
                <div style={{display: activeLoom != null ? 'block' : 'none'}}>
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
                                <Viewer name="reg" height={3 * this.height - 15} loomFile={activeLoom} activeFeatures={activeFeatures} thresholds={thresholds} scale={true} activeCoordinates={activeCoordinates} />
                            </Grid.Column>
                            <Grid.Column width={sidebar ? 4 : 5}>
                                <b>Cells passing thresholds</b>
                                <Viewer name="auc" height={3 * this.height / 2 - 15} loomFile={activeLoom} activeFeatures={activeFeatures} thresholds={thresholds} scale={false} activeCoordinates={activeCoordinates} />
                                <b>Expression levels</b>
                                <Viewer name="expr" height={3 * this.height / 2 - 15} loomFile={activeLoom} activeFeatures={geneFeatures} thresholds={thresholds} activeCoordinates={activeCoordinates} />
                            </Grid.Column>
                            <Grid.Column width={3}>
                                <b>Cell selections</b><hr />
                                <ViewerSidebar />
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </div>
            </div>
        );
    }

    componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
        BackendAPI.onActiveFeaturesChange(this.activeFeaturesListener);
        BackendAPI.onSidebarVisibleChange(this.sidebarVisibleListener);
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeActiveFeaturesChange(this.activeFeaturesListener);
        BackendAPI.removeSidebarVisibleChange(this.sidebarVisibleListener)
    }

    getGeneFeatures(features) {
        let geneFeatures = {};
        _.times(3, (i) => {
            let v = features[i].value.split('_');
            geneFeatures[i] = {type:'gene', value: v[0]}
        });
        return geneFeatures;
    }

    onThresholdChange(idx, threshold) {
        let thresholds = this.state.thresholds;
        thresholds[idx] = threshold;
        BackendAPI.setThresholds(thresholds);
        this.setState({thresholds: thresholds});
    }

}
