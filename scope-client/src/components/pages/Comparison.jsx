import React, { Component } from 'react'
import { Header, Grid } from 'semantic-ui-react'
import { BackendAPI } from '../common/API'

export default class Comparison extends Component {
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
                </div>
            </div>
        );
    }
}