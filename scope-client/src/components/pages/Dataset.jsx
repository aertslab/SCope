import React, { Component } from 'react'
import { Header, Grid } from 'semantic-ui-react'
import { BackendAPI } from '../common/API'
import ReactJson from 'react-json-view'


export default class Dataset extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            metadata: BackendAPI.getActiveLoomMetadata()
        }
        BackendAPI.onActiveLoomChange((loom, metadata) => {
            console.log('activeLoom changed', metadata);
            this.setState({activeLoom: loom, metadata: metadata});
        });
    }

    render() {
        const { activeLoom, metadata } = this.state;
        return (
            <div>
                <div style={{display: activeLoom == null ? 'block' : 'none'}}>
                    Select the dataset to be analyzed
                </div>
                <div style={{display: activeLoom != null ? 'block' : 'none'}}>
                    Active loom file: <b>{activeLoom}</b><br /><br />
                    <ReactJson src={metadata} collapsed={2} />
                </div>
            </div>
        );
    }
}