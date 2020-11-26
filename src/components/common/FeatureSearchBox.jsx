import React, { Component } from 'react';
import { Label, Segment, Icon, Popup, Image } from 'semantic-ui-react';
import FeatureSearchInput from './FeatureSearchInput';
import { BackendAPI } from './API';
import ReactGA from 'react-ga';

export default class FeatureSearch extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isLoading: false,
            results: [],
            value: props.value,
            selection: null,
            type: props.type,
        };
        this.call = null;
    }

    render() {
        const { isLoading, value, results, type, disabled } = this.state;
        const { inputLocked, selectLocked, color, options } = this.props;

        return (
            <Segment
                color={color}
                inverted={color ? true : false}
                className={color ? 'noPadding' : 'noFrame'}>
                <FeatureSearchInput
                    category
                    loading={isLoading}
                    onResultSelect={this.handleResultSelect.bind(this)}
                    onSearchChange={this.handleSearchChange.bind(this)}
                    handleTypeChange={this.handleTypeChange.bind(this)}
                    onSelectionChange={this.handleSelectionChange.bind(this)}
                    onBlur={this.handleBlur.bind(this)}
                    onMouseDown={this.handleMouseDown.bind(this)}
                    stopRequest={() => {
                        if (this.call != null) this.call.end();
                    }}
                    results={results}
                    options={options}
                    selectFirstResult={true}
                    value={value}
                    type={type}
                    inputLocked={inputLocked}
                    selectLocked={selectLocked}
                />
            </Segment>
        );
    }

    resetComponent() {
        this.setState({
            isLoading: false,
            results: [],
            value: '',
            selection: null,
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
        this.setState({ value: feature, selection: null });
        // TODO: Hacky implementation. To be refactored/reviewed properly
        BackendAPI.queryLoomFiles(
            BackendAPI.getUUID(),
            () => {
                BackendAPI.updateFeature(
                    this.props.field,
                    this.state.type,
                    feature,
                    featureType,
                    featureDescription
                );
            },
            BackendAPI.getActiveLoom()
        );
        ReactGA.event({
            category: 'action',
            action: 'feature selected',
            label: featureType + ': ' + feature,
            value: this.props.field,
        });
    }

    handleMouseDown(e, { result }) {
        e.stopPropagation();
        //e.preventDefault();
    }

    handleResultSelect(e, { result }) {
        e.stopPropagation();
        e.preventDefault();
        if (DEBUG) console.log('handleResultSelect', e, result);
        if (this.props.onResultSelect) {
            this.props.onResultSelect(result);
        } else {
            this.updateFeature(result.title, result.type, result.description);
        }
    }

    handleTypeChange(type) {
        this.setState({ type: type });
        ReactGA.event({
            category: 'action',
            action: 'feature type selected',
            label: type,
            value: this.props.field,
        });
    }

    handleSelectionChange(e, { result }) {
        if (DEBUG) console.log('handleSelectionChange', e, result);
        e.preventDefault();
        this.setState({ selection: result });
    }

    handleBlur(e, select) {
        e.stopPropagation();
        e.preventDefault();
        let selection = this.state.selection;
        if (DEBUG) console.log('handleBlur', e, select, selection);
        if (selection) {
            //selection = select.results[0].results[0];
            this.updateFeature(
                selection.title,
                selection.type,
                selection.description
            );
        }
    }

    handleSearchChange(e, { value }) {
        if (this.call != null) this.call.end();
        this.setState({ isLoading: true, value });
        if (this.state.value.length < 1) return this.resetComponent();
        let query = {
            loomFilePath: BackendAPI.getActiveLoom(),
            query: this.state.value,
        };
        if (DEBUG) console.log('getFeatures', query);
        BackendAPI.getConnection().then(
            (gbc) => {
                this.call = gbc.services.scope.Main.getFeatures(
                    query,
                    (err, response) => {
                        if (DEBUG) console.log('getFeatures', response);
                        if (response != null) {
                            let res = [],
                                genes = [],
                                regulons = [],
                                clusters = {},
                                annotations = [],
                                metrics = [];
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
                                    activeMetadata.cellMetaData.clusterings.map(
                                        (c, i) => {
                                            if (c.id == cid) {
                                                name = c.name;
                                            }
                                        }
                                    );
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

                            // Limit to maximum 10 results
                            genes = { name: 'gene', results: genes };
                            regulons = { name: 'regulon', results: regulons };
                            annotations = {
                                name: 'annotation',
                                results: annotations,
                            };
                            metrics = { name: 'metric', results: metrics };

                            // Only show results for the selected result type (gene | regulon | cluster | annotation)
                            if (
                                genes['results'].length &&
                                (type == 'all' || type == 'gene')
                            ) {
                                res.push(genes);
                            }
                            if (
                                regulons['results'].length &&
                                (type == 'all' || type == 'regulon')
                            ) {
                                res.push(regulons);
                            }
                            if (
                                (annotations['results'].length &&
                                    type == 'all') ||
                                type == 'annotation'
                            ) {
                                res.push(annotations);
                            }
                            if (
                                (metrics['results'].length && type == 'all') ||
                                type == 'metric'
                            ) {
                                res.push(metrics);
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
        ReactGA.event({
            category: 'action',
            action: 'feature search',
            label: value,
            value: this.props.field,
        });
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        this.setState({ value: nextProps.value, type: nextProps.type });
        if (this.props.value != nextProps.value) {
            this.handleSearchChange(null, nextProps.value);
        }
    }
}
