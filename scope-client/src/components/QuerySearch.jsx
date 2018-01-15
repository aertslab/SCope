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
        this.props.homeref.selectFeature(result.title)
    }

    handleSearchChange = (e, { value }) => {
        this.setState({ isLoading: true, value })
        setTimeout(() => {
            if (this.state.value.length < 1) return this.resetComponent()
            let query = { 
                lfp: this.props.loom
                , q: this.state.value 
            };
            this.props.gbwccxn.then((gbc) => {
                gbc.services.scope.Main.getFeatures(query, (err, response) => {
                    // Subset the top results
                    if(response !== null) {
                        let res_top = response.v.slice(0, 10).map((x) => {
                            return {"title": x}
                        });
                        let res = {"gene":{"name":"gene","results":res_top}}
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