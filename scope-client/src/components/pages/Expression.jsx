import React, { Component } from 'react'
import { Grid } from 'semantic-ui-react'
import { BackendAPI } from '../common/API'
import FeatureSearchBox from '../common/FeatureSearchBox'
import Viewer from '../common/Viewer'
import ViewerToolbar from '../common/ViewerToolbar'
import ViewerSidebar from '../common/ViewerSidebar'

export default class Expression extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            activeMetadata: BackendAPI.getActiveLoomMetadata(),
            activeFeatures: BackendAPI.getActiveFeatures('expression'),
            sidebar: BackendAPI.getSidebarVisible(),
            colors: BackendAPI.getColors()
        }
        this.activeLoomListener = (loom, metadata, coordinates) => {
            if (DEBUG) console.log('activeLoomListener', loom, metadata, coordinates);
            this.setState({activeLoom: loom, activeCoordinates: coordinates, activeMetadata: metadata});
        };
        this.activeFeaturesListener = (features, featureID) => {
            if (DEBUG) console.log('activeFeaturesListener', features, featureID);
            this.setState({activeFeatures: features});
        }
        this.sidebarVisibleListener = (state) => {
            this.setState({sidebar: state});
            this.forceUpdate();
        }
        this.height = window.innerHeight - 200;
    }

    render() {
        const { activeLoom, activeFeatures, activeCoordinates, sidebar, activeMetadata, colors } = this.state;
        let featureSearch = _.times(3, i => (
            <Grid.Column width={sidebar ? 4 : 5} key={i}>
                <FeatureSearchBox field={i} color={colors[i]} type='all' value={activeFeatures[i] ? activeFeatures[i].feature : ''} />
            </Grid.Column>
        ));
        /*
        if (activeMetadata && activeMetadata.cellMetaData && activeMetadata.cellMetaData.clusterings) {
            activeMetadata.cellMetaData.clusterings.map((c, i) => {
                options.push({ key: 'cluster#'+c.id, text: "clustering"+c.name, value: 'cluster#'+c.id })
            })
        }
        */

        if (!activeLoom) return (
            <div>
                Select the dataset to be analyzed
            </div>
        );

        return (
            <Grid>
                <Grid.Row columns="3">
                    {featureSearch}
                </Grid.Row>
                <Grid.Row columns="3">
                    <Grid.Column width={1}>
                        <ViewerToolbar />
                    </Grid.Column>
                    <Grid.Column width={sidebar ? 10 : 12}>
                        <b>Expression levels</b>
                        <Viewer name="expr" height={this.height} loomFile={activeLoom} activeFeatures={activeFeatures} activeCoordinates={activeCoordinates} />
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
        BackendAPI.onActiveFeaturesChange('expression', this.activeFeaturesListener);
        BackendAPI.onSidebarVisibleChange(this.sidebarVisibleListener);
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeActiveFeaturesChange('expression', this.activeFeaturesListener);
        BackendAPI.removeSidebarVisibleChange(this.sidebarVisibleListener);
    }


}
