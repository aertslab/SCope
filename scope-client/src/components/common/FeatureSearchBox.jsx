import React, { Component, PropTypes } from 'react'
import { Segment, Search, Label } from 'semantic-ui-react'
import FeatureSearchInput from './FeatureSearchInput';
import { BackendAPI } from './API' 

export default class FeatureSearch extends React.Component {

    constructor() {
        super()
        this.state = {
            isLoading: false,
            results: [],
            value: ''
        };
    }

    resetComponent() {
        this.setState({ isLoading: false, results: [], value: '' })
        BackendAPI.setActiveFeature(this.props.id, '', '');
    }

    handleResultSelect(e, { result }) {
        this.setState({ value: result.title })
        BackendAPI.setActiveFeature(this.props.id, this.props.type, result.title);
    }

    handleSearchChange(e, { value }) {
        this.setState({ isLoading: true, value })
        setTimeout(() => {
            if (this.state.value.length < 1) return this.resetComponent()
            let query = { 
                lfp: BackendAPI.getActiveLoom(),
                q: this.state.value 
                // featureType: this.props.type
                // query: this.state.value
                // loomFilePath: BackendAPI.getActiveLoom()
            };
            BackendAPI.getConnection().then((gbc) => {
                gbc.services.scope.Main.getFeatures(query, (err, response) => {
                    let res = [];
                    if(response != null) {
                        let res_top = response.v.slice(0, 10).map((x) => {
                            return {"title": x}
                        });
                        // TODO: add featureType here
                        res = {"gene": {"name": this.props.type, "results":res_top}}
                        this.setState({
                            isLoading: false,
                            results: res,
                        })
                    } else {
                        this.setState({
                            isLoading: false,
                            results: [],
                        })
                    }
                });
            });
        }, 200)
    }

    render() {

        const { isLoading, value, results } = this.state
        const { type, locked } = this.props

        return (
            <FeatureSearchInput
                category
                loading={isLoading}
                onResultSelect={this.handleResultSelect.bind(this)}
                onSearchChange={this.handleSearchChange.bind(this)}
                results={results}
                value={value}
                type={type}
                locked={locked}
            />
        );
    }

}