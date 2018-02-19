import React, { Component } from 'react'
import { Header } from 'semantic-ui-react'
import FeatureSearchBar from '../common/FeatureSearchBar'
import { BackendAPI } from '../common/API' 
import TSNEViewer from '../common/TSNEViewer'

export default class Regulon extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeFeatures: BackendAPI.getActiveFeatures('regulon')
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
                    Select up to three regulons to be displayed on tSNE <br />
                    <FeatureSearchBar type="regulon" locked="1" activeFeatures={activeFeatures} />
                    <TSNEViewer width="1000" height="800" loomFile={activeLoom} activeFeatures={activeFeatures} />
                </div>
            </div>
        );
    }

}