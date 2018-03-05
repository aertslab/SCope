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
        let features = BackendAPI.getActiveFeatures();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            activeFeatures: features,
            geneFeatures: this.getGeneFeatures(features),
            sidebar: BackendAPI.getSidebarVisible(),
            colors: BackendAPI.getColors()
        };
        this.activeLoomListener = (loom, metadata, coordinates) => {
            this.setState({activeLoom: loom, activeCoordinates: coordinates});
        };
        this.activeFeaturesListener = (features) => {
            //let thresholds = this.state.thresholds;
            let geneFeatures = this.getGeneFeatures(features);
            this.setState({activeFeatures: features, geneFeatures: geneFeatures});
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
                        <Viewer name="reg" height={3 * this.height - 15} loomFile={activeLoom} activeFeatures={activeFeatures} scale={true} activeCoordinates={activeCoordinates} />
                    </Grid.Column>
                    <Grid.Column width={sidebar ? 4 : 5}>
                        <b>Cells passing thresholds</b>
                        <Viewer name="auc" height={3 * this.height / 2 - 15} loomFile={activeLoom} activeFeatures={activeFeatures} scale={false} activeCoordinates={activeCoordinates} />
                        <b>Expression levels</b>
                        <Viewer name="expr" height={3 * this.height / 2 - 15} loomFile={activeLoom} activeFeatures={geneFeatures} activeCoordinates={activeCoordinates} />
                    </Grid.Column>
                    <Grid.Column width={3}>
                        <b>Cell selections</b><hr />
                        <ViewerSidebar />
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

    getGeneFeatures(features) {
        let geneFeatures = [];
        features.map((f, i) => {
            let feature = Object.assign({}, f);
            if (feature && feature.feature) {
                feature.featureType = 'gene';
                feature.feature = feature.feature.split('_')[0];
            }
            geneFeatures.push(feature);
        })
        if (DEBUG) console.log('getGeneFeatures', features, geneFeatures);
        return geneFeatures;
    }

    onThresholdChange(idx, threshold) {
        let feature = this.state.activeFeatures[idx];
        BackendAPI.setActiveFeature(idx, feature.type, feature.featureType, feature.feature, threshold);
//        BackendAPI.setThresholds(thresholds);
  //      this.setState({thresholds: thresholds});
    }

}
