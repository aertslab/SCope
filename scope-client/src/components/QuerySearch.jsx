import React, { Component, PropTypes } from 'react'
import { Segment, Search, Label } from 'semantic-ui-react'
import QueryInputSearch from './QueryInputSearch';

export default class QuerySearch extends React.Component {

    constructor(props) {
        super(props)
        this.GBC = require("grpc-bus-websocket-client");

        this.state = {
            isLoading: false,
            results: [],
            value: ''
        };
    }

    componentWillMount() {
        this.resetComponent()
    }

    resetComponent = () => this.setState({ isLoading: false, results: [], value: '' })

    handleResultSelect = (e, { result }) => {
        this.setState({ value: result.title })
        this.props.homeref.selectFeatureValue(this.props.id, result.type, result.title)
    }

    handleSearchChange = (e, { value }) => {
        this.setState({ isLoading: true, value })
        setTimeout(() => {
            if (this.state.value.length < 1) return this.resetComponent()
            let query = {
                loomFilePath: this.props.loom
                , query: this.state.value
            };
            this.props.gbwccxn.then((gbc) => {
                gbc.services.scope.Main.getFeatures(query, (err, response) => {
                    // Subset the top results
                    if(response !== null) {
                        var gene_top = []
                        var reg_top = []
                        for (var i = 0; i < 10; i++) {
                            if (response.featureType[i] == 'gene') {
                                gene_top.push({"title": response.feature[i],
                                               "type": response.featureType[i]});
                            } else if (response.featureType[i] == 'regulon') {
                                reg_top.push({"title": response.feature[i],
                                               "type": response.featureType[i]});
                            }

                        };
                        if (gene_top.length != 0 && reg_top.length != 0) {
                          var res = {"gene":{"name":"genes","results":gene_top},
                                     "regulons":{"name":"regulons","results":reg_top}}
                        } else if (gene_top.length == 0) {

                          var res = {"regulons":{"name":"regulons","results":reg_top}}
                        } else {
                          var res = {"gene":{"name":"genes","results":gene_top}}
                        }
                        this.setState({
                            isLoading: false,
                            results: res,
                        })
                    } else {
                        console.log("No .loom has been loaded!")
                    }
                });
            });
        }, 200)
    }

    render() {

        const { isLoading, value, results } = this.state

        return (
            <div>
                <QueryInputSearch
                    category
                    loading={isLoading}
                    onResultSelect={this.handleResultSelect}
                    onSearchChange={this.handleSearchChange}
                    results={results}
                    value={value}
                    {...this.props}
                />
            </div>
        );
    }

}
