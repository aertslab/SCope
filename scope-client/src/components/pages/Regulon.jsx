import React, { Component } from 'react'
import { Header } from 'semantic-ui-react'
import FeatureSearchBar from '../common/FeatureSearchBar'
import { BackendAPI } from '../common/API' 
import TSNEViewer from '../common/TSNEViewer'

export default class Regulon extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom()
        }
        BackendAPI.onActiveLoomChange((loom) => {
            this.setState({activeLoom: loom});
        });
    }

    render() {
        const { activeLoom } = this.state;
        return (
            <div>
                <div style={{display: activeLoom == null ? 'block' : 'none'}}>
                    Select the dataset to be analyzed
                </div>
                <div style={{display: activeLoom != null ? 'block' : 'none'}}>
                    Select up to three regulons to be displayed on tSNE <br />
                    <FeatureSearchBar type="regulon" locked="1" />
                    <TSNEViewer width="600" height="600" loomFile={activeLoom}/>
                </div>
            </div>
        );
    }

}