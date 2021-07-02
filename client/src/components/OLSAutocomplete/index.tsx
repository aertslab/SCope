import PropTypes from 'prop-types';
import _ from 'lodash';
import React, { Component } from 'react';
import { Search, Grid, Label, SearchResultProps } from 'semantic-ui-react';
import { BackendAPI } from '../common/API';

const resultRenderer = (props: SearchResultProps) => {
    // FIXME: SearchResultProps type not optimal
    return (
        <div>
            <Grid>
                <Grid.Row>
                    <Grid.Column width={10}>
                        <Label content={props.label} color='grey' />
                    </Grid.Column>
                    <Grid.Column width={2}>
                        <Label content={props.ontology_prefix} color='blue' />
                    </Grid.Column>
                    <Grid.Column width={4}>
                        <Label content={props.obo_id} color='orange' />
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
    type: PropTypes.string,
};

const INITIAL_STATE = {
    isLoading: false,
    value: '',
    termName: '',
    termId: '',
    results: [],
    result: null,
};

type OLSResult = {
    // id: string; // e.g.: fbbt:class:http://purl.obolibrary.org/obo/FBbt_00048467
    iri: string; // e.g.: http://purl.obolibrary.org/obo/FBbt_00048467
    label: string; // e.g.: adult dopaminergic mesothoracic neuron a
    obo_id: string; // e.g.: FBbt:00048467
    ontology_name: string; // e.g.: fbbt
    ontology_prefix: string;
    short_form: string; // e.g.: FBbt_00048467
    type: string; // e.g.: class
};

type OLSAutocompleteProps = {
    updateParent: (result: any) => void;
};

type OLSAutocompleteState = {
    isLoading: boolean;
    value: string;
    termId: string;
    termName: string;
    results: OLSResult[];
    result: OLSResult | null;
};

export default class OLSAutocomplete extends Component<
    OLSAutocompleteProps,
    OLSAutocompleteState
> {
    constructor(props) {
        super(props);
        this.state = INITIAL_STATE;
    }

    handleResultSelect = (e: React.SyntheticEvent, { result }) => {
        console.log(result);
        this.props.updateParent(result);
        this.setState({
            value: result.label + ' (' + result.obo_id + ')',
            termId: result.id,
            result: result,
        });
    };

    queryOLS = async (query: string): Promise<OLSResult[]> => {
        const metadata = BackendAPI.getActiveLoomMetadata();

        // cl for Human & Mouse
        const ontology =
            metadata.fileMetaData.species === 'dmel' ? 'fbbt' : 'cl';
        const request = new Request(
            'https://www.ebi.ac.uk/ols/api/select?q=' +
                query +
                '&ontology=' +
                ontology
        );
        try {
            const response = await fetch(request);
            const data = await response.json();
            return data.response.docs;
        } catch (error) {
            console.error(error);
        }
        return Promise.resolve([]);
    };

    handleSearchChange = (e: React.SyntheticEvent, { value }) => {
        this.setState({ isLoading: true, value });
        setTimeout(async () => {
            const results = await this.queryOLS(value);

            if (this.state.value.length < 1) {
                return this.setState(INITIAL_STATE);
            }

            const re = new RegExp(_.escapeRegExp(this.state.value), 'i');
            const isMatch = (result: OLSResult) => re.test(result.label);

            this.setState({
                isLoading: false,
                results: _.filter(results, isMatch),
            });
        }, 300);
    };

    render() {
        const { isLoading, results } = this.state;

        return (
            <div key='ols-autocomplete'>
                <Search
                    loading={isLoading}
                    onResultSelect={this.handleResultSelect}
                    onSearchChange={_.debounce(this.handleSearchChange, 500, {
                        leading: true,
                    })}
                    results={results}
                    value={this.state.value}
                    resultRenderer={resultRenderer}
                    input={{ fluid: true }}
                    fluid={true}
                    placeholder='Search for an ontology term...'
                    {...this.props}
                />
                <br />
            </div>
        );
    }
}
