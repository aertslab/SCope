import React, { Component, ComponentClass } from 'react';
import {
    Label,
    Segment,
    Icon,
    Popup,
    Image,
    Search,
    SearchResultsProps,
    StrictSearchCategoryProps,
    Select,
    SemanticCOLORS,
    Grid,
} from 'semantic-ui-react';
import { debounce } from 'lodash';
import { BackendAPI } from '../common/API';

import { FEATURE_COLOURS } from '../../constants';
import { FeatureType } from '../../features';

import './FeatureSearchBox.css';

declare const DEBUG: boolean;

interface FeatureSearchBoxProps {
    /** Index into the list of these boxes */
    field: number;
    /** The feature type to search for */
    type: FeatureType;
    /** Restrict the dropdown to _only_ this initialised feature type */
    singleFeature: boolean;
    /** Used to en/dis-able the entire search box */
    enabled: boolean;
}

interface FeatureSearchBoxState {
    /** Currently fetching search results from the server */
    isLoading: boolean;
    /** The search results */
    results: Array<StrictSearchCategoryProps>;
    /** Current value of the text input (the search term; or the result) */
    value: string;
    /** The current feature type being filtered for */
    type: FeatureType;
}

/**
 * Initialise an "empty" categorical results array.
 */
function emptyResults(): Array<StrictSearchCategoryProps> {
    return [{ name: '', results: [] }];
}

/**
 * A text search input for (selectable categories) properties on the dataset.
 */
class FeatureSearchBox extends React.Component<
    FeatureSearchBoxProps,
    FeatureSearchBoxState
> {
    private call?: any;

    constructor(props: FeatureSearchBoxProps) {
        super(props);
        this.state = {
            isLoading: false,
            results: emptyResults(),
            value: '',
            type: this.props.type,
        };
        this.call = null;
    }

    render() {
        const { isLoading, value, results, type } = this.state;
        const { field, enabled, singleFeature } = this.props;
        const options = [
            { key: 'all', text: 'all features', value: 'all' },
            { key: 'gene', text: 'gene', value: 'gene' },
            { key: 'regulon', text: 'regulon', value: 'regulon' },
            { key: 'cluster', text: 'cluster', value: 'cluster' },
        ];
        const color = FEATURE_COLOURS[field] as SemanticCOLORS;

        return (
            <Segment color={color} inverted className='noPadding'>
                <Search
                    category
                    className='feature-search-input'
                    input={{ icon: 'search', iconPosition: 'left' }}
                    loading={isLoading}
                    placeholder='Search...'
                    onSearchChange={debounce(
                        this.handleSearchChange.bind(this),
                        150
                    )}
                    onResultSelect={this.handleResultSelect.bind(this)}
                    results={results}
                    value={value}
                    disabled={!enabled}
                />
                <Select
                    className={'icon typeSelect'}
                    options={options}
                    defaultValue={type}
                    disabled={!enabled || singleFeature}
                    onChange={this.handleTypeChange.bind(this)}
                />
            </Segment>
        );
    }

    resetComponent() {
        this.setState({
            isLoading: false,
            results: emptyResults(),
        });
        BackendAPI.setActiveFeature(
            this.props.field,
            this.state.type,
            '',
            '',
            0,
            null
        );
    }

    updateFeature(feature, featureType, featureDescription) {
        this.setState({ value: feature });
        BackendAPI.updateFeature(
            this.props.field,
            this.state.type,
            feature,
            featureType,
            featureDescription
        );
    }

    handleResultSelect(e, { result }) {
        e.stopPropagation();
        e.preventDefault();
        if (DEBUG) {
            console.log('handleResultSelect', e, result);
        }

        this.updateFeature(result.title, result.type, result.description);
    }

    handleTypeChange(type) {
        this.setState({ type: type });
    }

    handleSearchChange(e, { value }) {
        if (this.call != null) this.call.end();
        this.setState({ isLoading: true, value });
        if (value.length < 1) {
            this.resetComponent();
            return;
        }

        const query = {
            loomFilePath: BackendAPI.getActiveLoom(),
            query: value,
        };
        if (DEBUG) console.log('getFeatures', query);
        BackendAPI.getConnection().then(
            (gbc) => {
                this.call = gbc.services.scope.Main.getFeatures(
                    query,
                    this.extractResults.bind(this)
                );
            },
            () => {
                BackendAPI.showError();
            }
        );
    }

    extractResults(err, response) {
        if (DEBUG) console.log('getFeatures response:', response, err);
        if (response != null) {
            let res: any[] = [],
                genes: any[] = [],
                regulons: any[] = [],
                clusters = {},
                annotations: any[] = [],
                metrics: any[] = [];
            let type = this.state.type;

            for (let i = 0; i < response.feature.length; i++) {
                let f = response.feature[i];
                let ft = response.featureType[i];
                let d = response.featureDescription[i];
                // Gene
                if (ft == 'gene') {
                    genes.push({
                        title: f,
                        type: ft,
                        description: d,
                    });
                    // Regulons
                } else if (ft == 'regulon') {
                    regulons.push({
                        title: f,
                        type: ft,
                        description: d,
                    });
                    // Annotations
                } else if (ft == 'annotation') {
                    annotations.push({
                        title: f,
                        type: ft,
                        description: d,
                    });
                    // Metric
                } else if (ft == 'metric') {
                    metrics.push({
                        title: f,
                        type: ft,
                        description: d,
                    });
                    // Clustering
                } else if (ft.indexOf('Clustering:') == 0) {
                    if (!clusters[ft]) clusters[ft] = [];
                    clusters[ft].push({
                        title: f,
                        type: ft,
                        description: d,
                    });
                } else if (ft.indexOf('cluster#') == 0) {
                    let cid = ft.split('#')[1],
                        name = '';
                    if (!clusters[ft])
                        clusters[ft] = {
                            name: name,
                            results: [],
                        };
                    clusters[ft].push({
                        title: f,
                        type: ft,
                        description: d,
                    });
                }
            }

            // Only show results for the selected result type (gene | regulon | cluster | annotation)
            if (genes.length && (type == 'all' || type == 'gene')) {
                res.push({ name: 'gene', results: genes });
            }
            if (regulons.length && (type == 'all' || type == 'regulon')) {
                res.push({ name: 'regulon', results: regulons });
            }
            if ((annotations.length && type == 'all') || type == 'annotation') {
                res.push({ name: 'annotations', results: annotations });
            }
            if ((metrics.length && type == 'all') || type == 'metric') {
                res.push({ name: 'metric', results: metrics });
            }
            if (type == 'all' || type == 'cluster') {
                Object.keys(clusters).map((ft) => {
                    res.push({
                        name: ft,
                        results: clusters[ft].slice(0, 10),
                    });
                });
            }

            this.setState({
                isLoading: false,
                results: res,
            });
        } else {
            this.setState({
                isLoading: false,
                results: emptyResults(),
            });
        }
    }
}

export { FeatureSearchBox };
