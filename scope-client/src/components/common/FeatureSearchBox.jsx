import React, { Component, PropTypes } from 'react'
import { Segment, Search, Label } from 'semantic-ui-react'
import FeatureSearchInput from './FeatureSearchInput';
import { BackendAPI } from './API' 

export default class FeatureSearch extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            isLoading: false,
            results: [],
            value: props.value
        };
    }

    resetComponent() {
        this.setState({ isLoading: false, results: [], value: '' })
        BackendAPI.setActiveFeature(this.props.id, this.props.type, '');
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
                loomFilePath: BackendAPI.getActiveLoom(),
                query: this.state.value 
            };
            BackendAPI.getConnection().then((gbc) => {
                gbc.services.scope.Main.getFeatures(query, (err, response) => {
                    if (response != null) {
                        var genes = []
                        var regulons = []
                        for (var i = 0; i < response.feature.length; i++) {
                            if (response.featureType[i] == 'gene') {
                                genes.push({
                                    "title": response.feature[i],
                                    "type": response.featureType[i]
                                });
                            } else if (response.featureType[i] == 'regulon') {
                                regulons.push({
                                    "title": response.feature[i],
                                    "type": response.featureType[i]
                                });
                            }
                        };
                        genes = genes.slice(0, 10)
                        regulons = regulons.slice(0, 10)
                        let res = [];
                        if (this.props.type == 'gene') {
                            res = {"gene": {"name": this.props.type, "results":genes}}
                        }
                        if (this.props.type == 'regulon') {
                            res = {"regulon": {"name": this.props.type, "results":regulons}}
                        }
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