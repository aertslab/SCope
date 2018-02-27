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
            activeFeatures: BackendAPI.getActiveFeatures('gene'),
            sidebar: BackendAPI.getSidebarVisible()
        }
        this.activeLoomListener = (loom, metadata, coordinates) => {
            console.log('loom change', loom, coordinates);
            this.setState({activeLoom: loom, activeCoordinates: coordinates});
        };
        this.activeFeaturesListener = (features) => {
            this.setState({activeFeatures: features});
        }
        this.sidebarVisibleListener = (state) => {
            this.setState({sidebar: state});
            this.forceUpdate();
        }
        this.height = window.innerHeight - 200;
    }

    render() {
        const { activeLoom, activeFeatures, activeCoordinates, sidebar } = this.state;
        return (
            <div>
                <div style={{display: activeLoom == null ? 'block' : 'none'}}>
                    Select the dataset to be analyzed
                </div>
                <div style={{display: activeLoom != null ? 'block' : 'none'}}>
                    <Grid>
                        <Grid.Row columns="3">
                            <Grid.Column width={sidebar ? 4 : 5}>
                                <FeatureSearchBox field="0" color="red" type="gene" locked="1" value={activeFeatures[0].value} />
                            </Grid.Column>
                            <Grid.Column width={sidebar ? 4 : 5}>
                                <FeatureSearchBox field="1" color="green" type="gene" locked="1" value={activeFeatures[1].value} />
                            </Grid.Column>
                            <Grid.Column width={sidebar ? 4 : 5}>
                                <FeatureSearchBox field="2" color="blue" type="gene" locked="1" value={activeFeatures[2].value} />
                            </Grid.Column>
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
        BackendAPI.removeSidebarVisibleChange(this.sidebarVisibleListener);
    }


}
