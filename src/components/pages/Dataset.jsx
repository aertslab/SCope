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

        if (!activeLoom) return (
            <div>
                Select the dataset to be analyzed
            </div>
        )

        return (
            <div>
                Active loom file: <b>{activeLoom}</b><br /><br />
                <ReactJson src={metadata} collapsed={2} />
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