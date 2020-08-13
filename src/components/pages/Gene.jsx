import React, { Component } from 'react';
import { Grid } from 'semantic-ui-react';
import { BackendAPI } from '../common/API';
import { FeatureSearch } from '../Search';
import Viewer from '../common/Viewer';
import ViewerToolbar from '../common/ViewerToolbar';
import ViewerSidebar from '../common/ViewerSidebar';

export default class Gene extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            activeMetadata: BackendAPI.getActiveLoomMetadata(),
            activeFeatures: BackendAPI.getActiveFeatures(),
            activeLegend: null,
            sidebar: BackendAPI.getSidebarVisible(),
        };
        this.activeLoomListener = (loom, metadata, coordinates) => {
            if (DEBUG)
                console.log('activeLoomListener', loom, metadata, coordinates);
            this.setState({
                activeLoom: loom,
                activeCoordinates: coordinates,
                activeMetadata: metadata,
            });
        };
        this.sidebarVisibleListener = (state) => {
            this.setState({ sidebar: state });
        };
        this.height = window.innerHeight - 200;
    }

    render() {
        const {
            activeLoom,
            activeFeatures,
            activeCoordinates,
            sidebar,
            activeMetadata,
            activeLegend,
        } = this.state;

        if (!activeLoom) return <div>Select the dataset to be analyzed</div>;

        return (
            <Grid>
                <FeatureSearch feature='all' />
                <Grid.Row columns='3' stretched className='viewerFlex'>
                    <Grid.Column width={1} className='viewerToolbar'>
                        <ViewerToolbar />
                    </Grid.Column>
                    <Grid.Column stretched>
                        <b>Expression levels</b>
                        <Viewer
                            name='expr'
                            loomFile={activeLoom}
                            activeFeatures={activeFeatures}
                            activeCoordinates={activeCoordinates}
                            onActiveLegendChange={(legend) => {
                                this.setState({ activeLegend: legend });
                            }}
                            customScale={true}
                            settings={true}
                            scale={true}
                        />
                    </Grid.Column>
                    <Grid.Column width={3}>
                        <ViewerSidebar
                            onActiveFeaturesChange={(features, id) => {
                                this.setState({ activeFeatures: features });
                            }}
                            activeLegend={activeLegend}
                        />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }

    UNSAFE_componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
        BackendAPI.onSidebarVisibleChange(this.sidebarVisibleListener);
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeSidebarVisibleChange(this.sidebarVisibleListener);
    }
}
