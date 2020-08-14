import React from 'react';
import _ from 'lodash';
import {
    Search,
    Input,
    Dropdown,
    Select,
    Icon,
    Segment,
} from 'semantic-ui-react';

import { BackendAPI } from './API';


export default class CollabAnnoGeneSearch extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isLoading: false,
            results: [],
            selection: null,
            type: 'gene',
            searchQuery: '',
            options: [],
            value: [],
        };
        this.call = null;
    }

    render() {
        const { isLoading, results, options, type } = this.state;

        return (
            <Dropdown
                className='collab-anno-drop'
                // category
                multiple
                search
                selection
                loading={isLoading}
                deburr={true}
                closeOnChange={true}
                onSearchChange={(evt, input) => {
                    evt.persist();
                    this.setState({ searchQuery: evt.target.value });
                    this.stopRequest();
                    this.handleSearchChangeDebounced.cancel();
                    this.handleSearchChangeDebounced(evt, input);
                }}
                onChange={this.updateValues.bind(this)}
                stopRequest={() => {
                    if (this.call != null) this.call.end();
                }}
                options={options}
                results={results}
                value={this.state.value}
                searchQuery={this.state.searchQuery}
                type={type}
            />
        );
    }

    updateValues(e, { value }) {
        this.setState({
            value: value,
            results: value.map((v) => {
                return { key: v, text: v, value: v };
            }),
            options: value.map((v) => {
                return { key: v, text: v, value: v };
            }),
            searchQuery: '',
        });
    }

    stopRequest() {
        if (this.call != null) this.call.end();
    }

    handleSearchChange(e, { value }) {
        this.setState({ isLoading: true, searchQuery: e.target.value });

        if (this.call != null) this.call.end();

        console.log(e.target.value);
        if (e.target.value.length < 1) return;

        let query = {
            loomFilePath: BackendAPI.getActiveLoom(),
            query: e.target.value,
        };
        if (DEBUG) console.log('getFeatures', query);
        BackendAPI.getConnection().then(
            (gbc) => {
                this.call = gbc.services.scope.Main.getFeatures(
                    query,
                    (err, response) => {
                        if (DEBUG) console.log('getFeatures', response);
                        if (response != null) {
                            const genes = _.zip(
                                response.feature,
                                response.featureType,
                                response.featureDescription
                            )
                                .filter(
                                    ([_, featureType, __]) =>
                                        featureType === 'gene'
                                )
                                .map(([feature, _, featureDescription]) => {
                                    return {
                                        text: feature,
                                        description: featureDescription,
                                        key: feature,
                                        value: feature,
                                    };
                                });
                            console.log(this.state);
                            console.log(this.props);
                            this.setState({
                                isLoading: false,
                                results: this.state.results.concat(genes),
                                options: this.state.options.concat(genes),
                            });
                        } else {
                            this.setState({
                                isLoading: false,
                                results: [],
                            });
                        }
                    }
                );
            },
            () => {
                BackendAPI.showError();
            }
        );
    }

    UNSAFE_componentWillMount() {
        this.handleSearchChangeDebounced = _.debounce((evt, input) => {
            this.handleSearchChange(evt, input);
        }, 750);
    }
}
