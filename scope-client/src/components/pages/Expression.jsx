import React, { Component } from 'react'
import { Header } from 'semantic-ui-react'
import { BackendAPI } from '../common/API' 
import FeatureSearchBar from '../common/FeatureSearchBar'
import TSNEViewer from '../common/TSNEViewer'

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
                    <FeatureSearchBar type="gene" locked="1" activeFeatures={activeFeatures} />
                    <TSNEViewer width="1000" height="800" loomFile={activeLoom} activeFeatures={activeFeatures} />
                </div>
            </div>
        );
    }

}