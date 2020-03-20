import React, { Component } from 'react';
import { Grid } from 'semantic-ui-react';
import { BackendAPI } from '../common/API';
import FeatureSearchBox from '../common/FeatureSearchBox';
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
            colors: BackendAPI.getColors()
        };
        this.activeLoomListener = (loom, metadata, coordinates) => {
            if (DEBUG)
                console.log('activeLoomListener', loom, metadata, coordinates);
            this.setState({
                activeLoom: loom,
                activeCoordinates: coordinates,
                activeMetadata: metadata
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
            colors,
            activeLegend
        } = this.state;
        const isQueryingAnnotation = activeFeatures.some((e) => {
            return e.featureType == 'annotation';
        });

        const featureSearch = () =>
            _.times(3, (i) => {
                let featureSearchboxDisabled = false;
                let color = colors[i];
                if (activeFeatures.length == 3) {
                    if (activeFeatures[i].featureType == 'annotation')
                        color = '#1b2944';
                    else {
                        if (isQueryingAnnotation) {
                            color = 'grey';
                            featureSearchboxDisabled = true;
                        }
                    }
                }
                return (
                    <Grid.Column key={i}>
                        <FeatureSearchBox
                            field={i}
                            color={color}
                            type='all'
                            value={
                                activeFeatures[i]
                                    ? activeFeatures[i].feature
                                    : ''
                            }
                            inputLocked={featureSearchboxDisabled}
                            selectLocked={featureSearchboxDisabled}
                        />
                    </Grid.Column>
                );
            });

        if (!activeLoom) return <div>Select the dataset to be analyzed</div>;

        return (
            <Grid>
                <Grid.Row columns='4' centered>
                    {featureSearch()}
                    <Grid.Column>&nbsp;</Grid.Column>
                </Grid.Row>
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
