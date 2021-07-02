import React, { Component } from 'react';
import { Grid } from 'semantic-ui-react';

import './pages.css';

import { BackendAPI } from '../common/API';
import Search from '../Search';
import Viewer from '../common/Viewer';
import ViewerToolbar from '../common/ViewerToolbar';
import RightSidebar from '../RightSidebar';

export default class Gene extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            activeMetadata: BackendAPI.getActiveLoomMetadata(),
            activeFeatures: BackendAPI.getActiveFeatures(),
            activeLegend: null,
        };
        this.activeLoomListener = (loom, metadata, coordinates) => {
            if (DEBUG) {
                console.log('activeLoomListener', loom, metadata, coordinates);
            }
            this.setState({
                activeLoom: loom,
                activeCoordinates: coordinates,
                activeMetadata: metadata,
            });
        };
    }

    render() {
        const { activeLoom, activeFeatures, activeCoordinates, activeLegend } =
            this.state;

        if (!activeLoom || activeLoom === '*') {
            return <div>Select the dataset to be analyzed</div>;
        }

        return (
            <div className='appPage'>
                <Search.FeatureSearchGroup
                    filter='all'
                    identifier='gene-page'
                />
                <Grid columns='equal' className='viewControls'>
                    <Grid.Column width={3} className='viewerToolbar'>
                        <ViewerToolbar location={this.props.location} />
                    </Grid.Column>
                    <Grid.Column>
                        <b className='viewerLabel'>Expression levels</b>
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
                            location={this.props.location}
                        />
                    </Grid.Column>
                    <Grid.Column width={4}>
                        <RightSidebar
                            onActiveFeaturesChange={(features) => {
                                this.setState({ activeFeatures: features });
                            }}
                            activeLegend={activeLegend}
                            identifier='gene-page'
                        />
                    </Grid.Column>
                </Grid>
            </div>
        );
    }

    componentDidMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
    }
}
