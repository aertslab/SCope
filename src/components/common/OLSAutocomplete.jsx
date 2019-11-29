import PropTypes from "prop-types";
import _ from "lodash";
import React, { Component } from "react";
import { Header, Search, Grid, Label } from "semantic-ui-react";
import { BackendAPI } from '../common/API'
import axios from "axios";

const resultRenderer = entry => {
    return (
        <div>
            <Grid>
                <Grid.Row>
                    <Grid.Column width={10}>
                        <Label content={entry.label} color='white'/>
                    </Grid.Column>
                    <Grid.Column width={2}>
                        <Label content={entry.ontology_prefix} color='blue'/>
                    </Grid.Column>
                    <Grid.Column width={4}>
                        <Label content={entry.obo_id} color='orange'/>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        </div>
    );
};

resultRenderer.propTypes = {
    id: PropTypes.string,
    iri: PropTypes.string,
    short_form: PropTypes.string,
    obo_id: PropTypes.string,
    label: PropTypes.string,
    ontology_name: PropTypes.string,
    ontology_prefix: PropTypes.string,
    type: PropTypes.string
};

const initialState = { isLoading: false, results: [], value: "" };

export default class OLSAutocomplete extends Component {

    state = initialState;

    handleResultSelect = (e, { result }) => {
        this.setState({ value: result.label });
        const { setNewAnnotationName } = this.props;
        setNewAnnotationName(result.label)
    }

    queryOLS = query => {
        let metadata = BackendAPI.getActiveLoomMetadata()
        let ontology = metadata.fileMetaData.species == "dmel" ? "fbbt": "cl" // cl for Human & Mouse
        axios
            .get("https://www.ebi.ac.uk/ols/api/select?q=" + query + "&ontology="+ ontology)
            .then(response => {
                this.setState({ results: response.data.response.docs });
            })
            .catch(function (error) {
                console.log(error);
            })
            .finally(function () { });
    };

    handleSearchChange = (e, { value }) => {
        this.setState({ isLoading: true, value });
        setTimeout(() => {
            this.queryOLS(value);
            if (this.state.value.length < 1) return this.setState(initialState);

            const re = new RegExp(_.escapeRegExp(this.state.value), "i");
            const isMatch = result => re.test(result.label);

            this.setState({
                isLoading: false,
                results: _.filter(this.state.results, isMatch)
            });
        }, 300);
    };

    render() {
        const { isLoading, value, results } = this.state;

        return (
            <div key="ols-autocomplete">
                <Header as='h2'>Search Annotation using EBI OLS</Header>
                <Search
                    loading={isLoading}
                    onResultSelect={this.handleResultSelect}
                    onSearchChange={_.debounce(this.handleSearchChange, 500, {
                        leading: true
                    })}
                    results={results}
                    value={value}
                    resultRenderer={resultRenderer}
                    input={{ fluid: true }}
                    className={{ fluid: true }}
                    {...this.props}
                />
                <br/>
            </div>
        );
    }
}
