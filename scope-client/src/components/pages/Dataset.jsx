import React, { Component } from 'react'
import { BackendAPI } from '../common/API'
import ReactJson from 'react-json-view'


export default class Dataset extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            metadata: BackendAPI.getActiveLoomMetadata()
        }
        this.activeLoomListener = (loom, metadata, coordinates) => {
            this.setState({activeLoom: loom, metadata: metadata});
        };
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

    componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);

    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
    }
}