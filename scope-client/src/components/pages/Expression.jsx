import React, { Component } from 'react'
import { Header, Grid } from 'semantic-ui-react'
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
            activeFeatures: BackendAPI.getActiveFeatures('gene')
        }
        console.log('features', this.state.activeFeatures);
        BackendAPI.onActiveLoomChange((loom) => {
            this.setState({activeLoom: loom});
        });
        BackendAPI.onActiveFeaturesChange((features) => {
            this.setState({activeFeatures: features});
        });
    }

    render() {
        const { activeLoom, activeFeatures } = this.state;
        return (
            <div>
                <div style={{display: activeLoom == null ? 'block' : 'none'}}>
                    Select the dataset to be analyzed
                </div>
                <div style={{display: activeLoom != null ? 'block' : 'none'}}>
                    Select up to three genes to be displayed on tSNE <br />
                    <Grid>
                        <Grid.Row columns="4">
                            <Grid.Column>
                                <FeatureSearchBox field="0" color="red" type="gene" locked="1" value={activeFeatures[0].value} />
                            </Grid.Column>
                            <Grid.Column>
                                <FeatureSearchBox field="1" color="green" type="gene" locked="1" value={activeFeatures[1].value} />
                            </Grid.Column>
                            <Grid.Column>
                                <FeatureSearchBox field="2" color="blue" type="gene" locked="1" value={activeFeatures[2].value} />
                            </Grid.Column>
                        </Grid.Row>
                        <Grid.Row columns="3">
                            <Grid.Column width={1}>
                                <ViewerToolbar />
                            </Grid.Column>
                            <Grid.Column width={10}>
                                <Viewer name="expr" width="1000" height="800" loomFile={activeLoom} activeFeatures={activeFeatures} />
                            </Grid.Column>
                            <Grid.Column width={3}>
                                <ViewerSidebar />
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </div>
            </div>
        );
    }

}
