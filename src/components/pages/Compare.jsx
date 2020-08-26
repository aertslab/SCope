import _ from 'lodash';
import * as d3 from 'd3';
import box2 from '../../js/box2.js';
import React, { Component } from 'react';
import { DragDropContext } from 'react-dnd';
import HTML5Backend, { NativeTypes } from 'react-dnd-html5-backend';
import { Accordion, Grid, Menu, Icon, Dropdown } from 'semantic-ui-react';
import { BackendAPI } from '../common/API';
import Annotation from '../common/Annotation';
import Search from '../Search';
import ViewerSidebar from '../common/ViewerSidebar';
import ViewerToolbar from '../common/ViewerToolbar';
import AnnotationDropContainer from '../common/AnnotationDropContainer';
import ViewerDropContainer from '../common/ViewerDropContainer';

import './compare.css';


class Compare extends Component {
    constructor(props) {
        super(props);

        let isConfigurationLocked =
            this.props.metadata &&
            this.props.metadata.cellMetaData &&
            this.props.metadata.cellMetaData.annotations.length
                ? false
                : true;
        let isSuperpositionLocked = isConfigurationLocked;
        let configurationDefaultValue = isConfigurationLocked
            ? 'multi'
            : 'simple';
        let superpositionDefaultValue = isConfigurationLocked ? 'NA' : 'OR';
        let nDisplays = isConfigurationLocked ? 2 : 4;
        let nRows = isConfigurationLocked ? 1 : 2;

        this.state = {
            activePage: BackendAPI.getActivePage(),
            multiLoom: BackendAPI.getActiveLooms(),
            multiCoordinates: [BackendAPI.getActiveCoordinates()],
            multiMetadata: [BackendAPI.getActiveLoomMetadata()],
            activeFeatures: BackendAPI.getActiveFeatures(),
            colors: BackendAPI.getColors(),
            activeAnnotation: -1,
            columns: 2,
            rows: nRows,
            displays: nDisplays,
            crossAnnotations: {
                horizontal: [],
                vertical: [],
                both: [],
                one: [],
            },
            configuration: configurationDefaultValue,
            superposition: superpositionDefaultValue,
            isConfigurationLocked: isConfigurationLocked,
            isSuperpositionLocked: isSuperpositionLocked,
            activeLegend: null,
        };

        this.loomConf = [];
        this.rebuildLoomOptions();
        this.activeLoomListener = (loom, metadata, coordinates) => {
            let multiLoom = this.state.multiLoom;
            let multiCoordinates = this.state.multiCoordinates;
            let multiMetadata = this.state.multiMetadata;
            let crossAnnotations = {
                horizontal: [],
                vertical: [],
                both: [],
                one: [],
            };
            multiLoom[0] = loom;
            multiCoordinates[0] = coordinates;
            multiMetadata[0] = metadata;
            this.setState({
                multiLoom,
                multiCoordinates,
                multiMetadata,
                crossAnnotations,
            });
            this.rebuildLoomOptions();
        };
        this.activeFeaturesListener = (features) => {
            this.setState({ activeFeatures: features });
            this.getCellMetadata();
        };
        this.displayConf = [
            { text: 'auto', value: 0, disabled: true },
            { text: '1', value: 1 },
            { text: '2', value: 2 },
            { text: '4', value: 4 },
            { text: '6', value: 6 },
            { text: '9', value: 9 },
        ];
        this.superpositionConf = [
            { text: 'N/A', value: 'NA', disabled: true },
            { text: 'AND', value: 'AND' },
            { text: 'OR', value: 'OR' },
        ];
        this.configurationConf = [
            { text: 'drag-and-drop', value: 'simple' },
            { text: 'one-type', value: 'one' },
            { text: 'cross-reference', value: 'cross' },
            { text: 'multi-dataset', value: 'multi' },
        ];
    }

    render() {
        const {
            activeThresholds,
            activeFeatures,
            activeLegend,
            crossAnnotations,
            activeAnnotation,
            annotationIDs,
            colors,
            displays,
            configuration,
            superposition,
            isSuperpositionLocked,
            isConfigurationLocked,
            multiLoom,
            multiCoordinates,
            multiMetadata,
        } = this.state;

        let annotationLinks = () => {
            if (configuration == 'one')
                return (
                    <span style={{ float: 'right' }}>
                        <a
                            className='pointer'
                            onClick={this.selectAllAnotations.bind(this)}>
                            all
                        </a>{' '}
                        -{' '}
                        <a
                            className='pointer'
                            onClick={this.selectNoAnotations.bind(this)}>
                            none
                        </a>
                    </span>
                );
        };

        let annotationTabs = () => {
            if (
                multiMetadata[0] &&
                multiMetadata[0].cellMetaData &&
                multiMetadata[0].cellMetaData.annotations
            ) {
                let annotations = multiMetadata[0].cellMetaData.annotations;
                return annotations.map((annotation, annotationID) => {
                    return (
                        <span key={annotationID}>
                            <Accordion.Title
                                active={activeAnnotation === annotationID}
                                index={annotationID}
                                onClick={this.selectAnnotationGroup.bind(this)}>
                                <Icon name='dropdown' />
                                {annotation.name}
                            </Accordion.Title>
                            <Accordion.Content
                                active={activeAnnotation == annotationID}>
                                <Menu vertical secondary>
                                    {annotation.values.map((value, valueID) => {
                                        return (
                                            <Annotation
                                                name={annotation.name}
                                                value={value}
                                                key={valueID}
                                                isDropped={this.isDropped(
                                                    annotation.name,
                                                    value
                                                )}
                                                onClick={this.selectAnnotation.bind(
                                                    this
                                                )}
                                            />
                                        );
                                    })}
                                </Menu>
                                {annotationLinks()}
                            </Accordion.Content>
                        </span>
                    );
                });
            }
        };

        let columns = this.state.columns;
        let rows = this.state.rows;
        if (configuration == 'one') {
            columns = 1;
            while (crossAnnotations['one'].length > columns * columns) {
                columns++;
            }
            rows = columns;
            while (columns * (rows - 1) >= crossAnnotations['one'].length) {
                rows--;
            }
            if (rows < 1) rows = 1;
        }

        let viewers = () => {
            return (
                <Grid>
                    {_.times(rows, (i) => (
                        <Grid.Row
                            columns={columns}
                            key={i}
                            className='viewerRow'
                            stretched>
                            {_.times(columns, (j) => {
                                let name = 'comp' + (columns * i + j);
                                let annotationDropContainerHorizontal,
                                    annotationDropContainerVertical,
                                    datasetSelector;
                                if (
                                    configuration == 'simple' ||
                                    configuration == 'one' ||
                                    (configuration == 'cross' && i == 0)
                                ) {
                                    let ca = crossAnnotations['horizontal'][j];
                                    if (configuration == 'simple')
                                        ca =
                                            crossAnnotations['both'][
                                                columns * i + j
                                            ];
                                    if (configuration == 'one')
                                        ca =
                                            crossAnnotations['one'][
                                                columns * i + j
                                            ];
                                    annotationDropContainerHorizontal = (
                                        <AnnotationDropContainer
                                            activeAnnotations={ca}
                                            viewerName={name}
                                            orientation={
                                                configuration == 'cross'
                                                    ? 'horizontal'
                                                    : configuration == 'one'
                                                    ? 'one'
                                                    : 'both'
                                            }
                                            position={
                                                configuration == 'cross'
                                                    ? j
                                                    : columns * i + j
                                            }
                                            onDrop={this.handleDrop.bind(this)}
                                            onRemove={this.handleRemove.bind(
                                                this
                                            )}
                                        />
                                    );
                                }
                                if (
                                    (configuration == 'cross' ||
                                        configuration == 'multi') &&
                                    j == 0
                                ) {
                                    annotationDropContainerVertical = (
                                        <AnnotationDropContainer
                                            activeAnnotations={
                                                crossAnnotations['vertical'][i]
                                            }
                                            viewerName={name}
                                            position={i}
                                            orientation='vertical'
                                            onDrop={this.handleDrop.bind(this)}
                                            onRemove={this.handleRemove.bind(
                                                this
                                            )}
                                        />
                                    );
                                }
                                if (configuration == 'multi' && i == 0) {
                                    let coordOptions = [],
                                        coordinatesSelector;
                                    if (
                                        multiMetadata[j] &&
                                        multiMetadata[j].cellMetaData &&
                                        multiMetadata[j].cellMetaData.embeddings
                                            .length
                                    ) {
                                        multiMetadata[
                                            j
                                        ].cellMetaData.embeddings.map(
                                            (coords) => {
                                                coordOptions.push({
                                                    text: coords.name,
                                                    value: coords.id,
                                                });
                                            }
                                        );
                                        coordinatesSelector = (
                                            <span>
                                                <b> coordinates: </b>
                                                <Dropdown
                                                    inline
                                                    options={coordOptions}
                                                    disabled={j == 0}
                                                    value={multiCoordinates[j]}
                                                    placeholder=' none selected '
                                                    onChange={(
                                                        proxy,
                                                        select
                                                    ) => {
                                                        let mc = multiCoordinates;
                                                        mc[j] = select.value;
                                                        this.setState({
                                                            multiCoordinates: mc,
                                                        });
                                                    }}
                                                />
                                            </span>
                                        );
                                    }
                                    datasetSelector = (
                                        <span className='noStretch'>
                                            <b>Select a dataset: </b>
                                            <Dropdown
                                                inline
                                                options={this.loomConf}
                                                disabled={j == 0}
                                                value={multiLoom[j]}
                                                scrolling
                                                placeholder=' none selected '
                                                onChange={(proxy, select) => {
                                                    let ml = multiLoom;
                                                    let mc = multiCoordinates;
                                                    let mm = multiMetadata;
                                                    ml[j] = select.value;
                                                    mc[j] = -1;
                                                    mm[
                                                        j
                                                    ] = BackendAPI.getLoomMetadata(
                                                        ml[j]
                                                    );
                                                    BackendAPI.setActiveLooms(
                                                        ml
                                                    );
                                                    this.setState({
                                                        multiLoom: ml,
                                                        multiCoordinates: mc,
                                                    });
                                                }}
                                            />
                                            {coordinatesSelector}
                                        </span>
                                    );
                                }
                                let va;
                                if (configuration == 'simple')
                                    va =
                                        crossAnnotations['both'][
                                            columns * i + j
                                        ];
                                else if (configuration == 'one')
                                    va =
                                        crossAnnotations['one'][
                                            columns * i + j
                                        ];
                                else va = this.getCrossAnnotations(i, j);
                                return (
                                    <Grid.Column key={j} className='viewerCell'>
                                        {datasetSelector}
                                        {annotationDropContainerHorizontal}
                                        {annotationDropContainerVertical}
                                        <ViewerDropContainer
                                            active={
                                                configuration == 'simple'
                                                    ? true
                                                    : false
                                            }
                                            key={columns * i + j}
                                            onDrop={this.handleDrop.bind(this)}
                                            onRemove={this.handleRemove.bind(
                                                this
                                            )}
                                            name={name}
                                            loomFile={
                                                configuration == 'multi'
                                                    ? multiLoom[j]
                                                    : multiLoom[0]
                                            }
                                            activeFeatures={activeFeatures}
                                            superposition={superposition}
                                            activeCoordinates={
                                                configuration == 'multi'
                                                    ? multiCoordinates[j]
                                                        ? multiCoordinates[j]
                                                        : -1
                                                    : multiCoordinates[0]
                                            }
                                            activeAnnotations={va}
                                            orientation={
                                                configuration == 'one'
                                                    ? 'one'
                                                    : 'both'
                                            }
                                            position={columns * i + j}
                                            configuration={configuration}
                                            customScale={true}
                                            settings={true}
                                            translate={true}
                                            scale={true}
                                            onActiveLegendChange={(legend) => {
                                                this.setState({
                                                    activeLegend: legend,
                                                });
                                            }}
                                            location={this.props.location}
                                        />
                                    </Grid.Column>
                                );
                            })}
                        </Grid.Row>
                    ))}
                </Grid>
            );
        };

        if (!multiLoom[0]) return <div>Select the dataset to be analyzed</div>;

        return (
            <Grid>
                <Search.FeatureSearchGroup
                    feature='all'
                    identifier='compare-page' />
                <Grid.Row columns={3} stretched className='viewerRow'>
                    <Grid.Column width={2} >
                        <div className='compare-menu'>
                            Number of displays: &nbsp;
                            <Dropdown
                                inline
                                options={this.displayConf}
                                disabled={configuration == 'one'}
                                value={displays}
                                onChange={this.displayNumberChanged.bind(this)}
                            />
                            <br />
                            Superposition: &nbsp;
                            <Dropdown
                                inline
                                disabled={
                                    configuration == 'one' && isSuperpositionLocked
                                }
                                options={this.superpositionConf}
                                value={superposition}
                                onChange={this.superpositionChanged.bind(this)}
                            />
                            <br />
                            Configuration: &nbsp;
                            <Dropdown
                                inline
                                options={this.configurationConf}
                                disabled={isConfigurationLocked}
                                defaultValue={configuration}
                                onChange={this.configurationChanged.bind(this)}
                            />
                            <Accordion styled>{annotationTabs()}</Accordion>
                            <br />
                            {/* <ViewerToolbar location={this.props.location} /> */}
                        </div>
                    </Grid.Column>
                    <Grid.Column stretched width={11} className='viewerCell'>
                        {viewers()}
                    </Grid.Column>
                    <Grid.Column width={3}>
                        <div
                            className='chart-wrapper noStretch'
                            id='chart-distro1'
                            style={{ width: '100%' }}
                            height='200px'></div>
                        <ViewerSidebar
                            getSelectedAnnotations={this.getSelectedAnnotations.bind(
                                this
                            )}
                            onActiveFeaturesChange={(features, id) => {
                                this.setState({ activeFeatures: features });
                            }}
                            activeLegend={activeLegend}
                        />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }

    UNSAFE_componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
        BackendAPI.onActiveFeaturesChange(
            this.state.activePage,
            this.activeFeaturesListener
        );
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeActiveFeaturesChange(
            this.state.activePage,
            this.activeFeaturesListener
        );
    }

    isDropped(name, value) {
        let selected = false;
        let annotations = this.state.crossAnnotations;
        Object.keys(annotations).map((orientation) => {
            annotations[orientation].map((annotation) => {
                let va = annotation[name];
                if (va && va.indexOf(value) != -1) selected = true;
            });
        });
        return selected;
    }

    handleDrop(item, viewer, orientation, position) {
        if (DEBUG)
            console.log('handleDrop', item, viewer, orientation, position);
        let annotations = this.state.crossAnnotations;
        if (!annotations[orientation][position])
            annotations[orientation][position] = {};
        let selectedAnnotations = (
            annotations[orientation][position][item.name] || []
        ).slice(0);
        if (selectedAnnotations.indexOf(item.value) != -1) {
            alert('This annotation is already shown in that viewer');
            return false;
        }
        selectedAnnotations.push(item.value);
        annotations[orientation][position][item.name] = selectedAnnotations;
        this.setState({ crossAnnotations: annotations });
        this.getCellMetadata();
        return true;
    }

    handleRemove(viewer, name, value, orientation, position) {
        if (DEBUG)
            console.log(
                'handleRemove',
                viewer,
                name,
                value,
                orientation,
                position
            );
        let cross = this.state.crossAnnotations;
        let annotations = cross[orientation][position] || {};
        let selectedAnnotations = (annotations[name] || []).slice(0);
        let idx = selectedAnnotations.indexOf(value);
        if (idx != -1) {
            selectedAnnotations.splice(idx, 1);
            if (selectedAnnotations.length == 0) {
                delete cross[orientation][position][name];
            } else {
                cross[orientation][position][name] = selectedAnnotations;
            }
            this.setState({ crossAnnotations: cross });
        } else {
            console.log('Annotation cannot be found', viewer, name, remove);
        }
        this.getCellMetadata();
    }

    displayNumberChanged(proxy, selection) {
        setTimeout(() => {
            if (selection.value == 1) {
                this.setState({ columns: 1, rows: 1, displays: 1 });
            } else if (selection.value == 2) {
                this.setState({ columns: 2, rows: 1, displays: 2 });
            } else if (selection.value == 4) {
                this.setState({ columns: 2, rows: 2, displays: 4 });
            } else if (selection.value == 6) {
                this.setState({ columns: 3, rows: 2, displays: 6 });
            } else if (selection.value == 9) {
                this.setState({ columns: 3, rows: 3, displays: 9 });
            }
        }, 100);
    }

    superpositionChanged(proxy, selection) {
        setTimeout(() => {
            this.setState({ superposition: selection.value });
        }, 100);
    }

    configurationChanged(proxy, selection) {
        setTimeout(() => {
            let conf = selection.value;
            let displays = this.state.displays;
            let superposition = this.state.superposition;
            let crossAnnotations = {
                horizontal: [],
                vertical: [],
                both: [],
                one: [],
            };
            if (conf == 'one') {
                displays = 0;
                superposition = 'NA';
            } else {
                displays = this.state.rows * this.state.columns;
                superposition = 'OR';
            }

            if (conf == 'multi') {
                displays = 2;
                this.setState({ columns: 2, rows: 1, displays: displays });
            }

            this.setState({
                configuration: conf,
                displays: displays,
                superposition: superposition,
                crossAnnotations: crossAnnotations,
            });
            this.getCellMetadata();
        }, 100);
    }

    selectAllAnotations() {
        const {
            crossAnnotations,
            activeAnnotation,
            multiMetadata,
        } = this.state;
        let annotationIDs = [];
        let annotationGroup =
            multiMetadata[0].cellMetaData.annotations[activeAnnotation];
        annotationGroup.values.map((value, valueID) => {
            let a = {};
            a[annotationGroup.name] = [value];
            annotationIDs.push(a);
        });
        crossAnnotations['one'] = annotationIDs;
        this.setState({ crossAnnotations: crossAnnotations });
        this.getCellMetadata();
    }

    selectNoAnotations() {
        let { crossAnnotations } = this.state;
        const { activeAnnotation, multiMetadata } = this.state;
        let annotationGroup =
            multiMetadata[0].cellMetaData.annotations[activeAnnotation];
        crossAnnotations['one'] = [];
        this.setState({ crossAnnotations: crossAnnotations });
        this.getCellMetadata();
    }

    selectAnnotation(name, value, selected) {
        if (this.state.configuration == 'one') {
            let annotations = this.state.crossAnnotations;
            if (!selected) {
                let a = {};
                a[name] = [value];
                annotations['one'].push(a);
            } else {
                let idx = -1;
                annotations['one'].map((a, i) => {
                    if (a[name][0] == value) {
                        idx = i;
                    }
                });
                annotations['one'].splice(idx, 1);
            }
            annotations['one'].sort((a, b) => {
                let va = a[name][0],
                    vb = b[name][0];
                let pa = parseInt(va),
                    pb = parseInt(vb);
                if (!isNaN(pa) && !isNaN(pb))
                    return pa > pb ? 1 : pa < pb ? -1 : 0;
                return va > vb ? 1 : va < vb ? -1 : 0;
            });
            this.setState({ crossAnnotations: annotations });
        }
    }

    selectAnnotationGroup(e, props) {
        const { index } = props;
        let { activeAnnotation, crossAnnotations } = this.state;
        const { multiMetadata } = this.state;
        crossAnnotations['one'] = [];
        this.setState({
            activeAnnotation: activeAnnotation == index ? -1 : index,
            crossAnnotations: crossAnnotations,
        });
        let annotationGroup = multiMetadata[0].cellMetaData.annotations[index];
    }

    getCrossAnnotations(i, j) {
        let annotations = {},
            cross = this.state.crossAnnotations;
        if (cross['horizontal'][j]) {
            Object.keys(cross['horizontal'][j]).map((a) => {
                annotations[a] = annotations[a] || [];
                cross['horizontal'][j][a].map((v) => {
                    if (annotations[a].indexOf(v) == -1) annotations[a].push(v);
                });
            });
        }
        if (cross['vertical'][i]) {
            Object.keys(cross['vertical'][i]).map((a) => {
                annotations[a] = annotations[a] || [];
                cross['vertical'][i][a].map((v) => {
                    if (annotations[a].indexOf(v) == -1) annotations[a].push(v);
                });
            });
        }
        return annotations;
    }

    getSelectedAnnotations() {
        let annotations = this.state.crossAnnotations;
        let selectedAnnotations = {};
        Object.keys(annotations).map((orientation) => {
            annotations[orientation].map((annotation) => {
                Object.keys(annotation).map((a) => {
                    selectedAnnotations[a] = selectedAnnotations[a] || [];
                    annotation[a].map((v) => {
                        if (selectedAnnotations[a].indexOf(v) == -1)
                            selectedAnnotations[a].push(v);
                    });
                });
            });
        });
        return selectedAnnotations;
    }

    getCellMetadata() {
        let settings = BackendAPI.getSettings();
        let selectedAnnotations = this.getSelectedAnnotations();
        const {
            selectedGenes,
            selectedRegulons,
            selectedClusters,
        } = BackendAPI.getParsedFeatures();
        let query = {
            loomFilePath: this.state.multiLoom[0],
            cellIndices: [],
            hasLogTransform: settings.hasLogTransform,
            hasCpmTransform: settings.hasCpmNormalization,
            selectedGenes: selectedGenes,
            selectedRegulons: selectedRegulons,
            clusterings: [],
            annotations: Object.keys(selectedAnnotations),
        };
        BackendAPI.getConnection().then(
            (gbc) => {
                if (DEBUG) console.log('getCellMetaData', query);
                gbc.services.scope.Main.getCellMetaData(
                    query,
                    (err, response) => {
                        if (DEBUG) console.log('getCellMetaData', response);
                        this.renderExpressionGraph(response);
                    }
                );
            },
            () => {
                BackendAPI.showError();
            }
        );
    }

    renderExpressionGraph(data) {
        const {
            selectedGenes,
            selectedRegulons,
            selectedClusters,
        } = BackendAPI.getParsedFeatures();
        if (selectedGenes.length + selectedRegulons.length == 0) return;
        let selectedAnnotations = this.getSelectedAnnotations();
        d3.select('#chart-distro1').select('svg').remove();
        Object.keys(selectedAnnotations).map((annotation, ai) => {
            let selections = 0;
            let dataset = [];
            selectedGenes.map((gene, gi) => {
                data.annotations[ai].annotations.map((av, i) => {
                    dataset.push({
                        feature: selections,
                        annotation: av,
                        value: data.geneExpression[gi].features[i],
                    });
                });
                selections++;
            });
            selectedRegulons.map((regulon, ri) => {
                data.annotations[ai].annotations.map((av, i) => {
                    dataset.push({
                        feature: selections,
                        annotation: av,
                        value: data.aucValues[ri].features[i],
                    });
                });
                selections++;
            });

            let bbox = d3
                .select('#chart-distro1')
                .node()
                .getBoundingClientRect();
            let margin = { top: 30, right: 50, bottom: 70, left: 50 };
            let width = bbox.width - margin.left - margin.right;
            let height = 200 - margin.top - margin.bottom;
            let min = Infinity,
                max = -Infinity;

            let x0 = d3.scaleBand().range([0, width], 0.5);
            let x_1 = d3.scaleBand();
            let y_0 = d3.scaleLinear().range([height + margin.top, 0]);
            let xAxis1 = d3.axisBottom(x0);
            let yAxis1 = d3.axisLeft(y_0);
            let svg1 = d3
                .select('#chart-distro1')
                .append('svg')
                .attr('class', 'box')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
                .append('g')
                .attr(
                    'transform',
                    'translate(' + margin.left + ',' + margin.top + ')'
                );
            let features = d3
                .map(dataset, function (d) {
                    return d.feature;
                })
                .keys();
            let annotations = d3
                .map(dataset, function (d) {
                    return d.annotation;
                })
                .keys();
            let graphData = [];
            let tmp = [];
            annotations.forEach(function (a) {
                let annotatedFeatures = [];
                features.forEach(function (f) {
                    let featureValues = [];
                    dataset.forEach(function (d) {
                        if (d.annotation == a && d.feature == f) {
                            featureValues.push(d.value);
                        }
                    });
                    annotatedFeatures.push({ group: f, value: featureValues });
                });
                if (selectedAnnotations[annotation].indexOf(a) != -1)
                    graphData.push({ annotation: a, Data: annotatedFeatures });
            });
            min =
                d3.min(dataset, function (d) {
                    return d.value;
                }) * 0.995;
            max =
                d3.max(dataset, function (d) {
                    return d.value;
                }) * 1.005;
            x0.domain(selectedAnnotations[annotation]);
            x_1.domain(features).range([0, x0.bandwidth() - 10]);
            y_0.domain([min, max]);
            svg1.append('g')
                .attr('class', 'x axis')
                .attr('transform', 'translate(0,' + (height + margin.top) + ')')
                .call(xAxis1)
                .append('text')
                //.attr("transform", "rotate(-90)")
                .attr('dy', 30)
                .attr('fill', 'black')
                .attr('dx', width)
                .style('text-anchor', 'end')
                .text(annotation);

            svg1.append('g')
                .attr('class', 'y axis')
                .call(yAxis1)
                .append('text')
                .attr('fill', 'black')
                .attr('transform', 'rotate(-90)')
                .attr('y', 6)
                .attr('dy', -30)
                .style('text-anchor', 'end')
                .text('Expression');

            let bandwidth = x_1.bandwidth();
            let translate = (bandwidth - 100) / 2;
            translate = translate > 0 ? translate : 0;

            let boxplot = box2()
                .whiskers(this.iqr(1.5))
                .width(bandwidth < 100 ? bandwidth : 100)
                .height(height + margin.top)
                .domain([min, max])
                .showLabels(false);

            let state = svg1
                .selectAll('.state2')
                .data(graphData)
                .enter()
                .append('g')
                .attr('class', 'state')
                .attr('transform', function (d) {
                    return 'translate(' + x0(d.annotation) + ',0)';
                });

            state
                .selectAll('.box')
                .data(function (d) {
                    return d.Data;
                })
                .enter()
                .append('g')
                .attr('transform', function (d) {
                    return (
                        'translate(' + (x_1(d.group) + 5 + translate) + ',0)'
                    );
                })
                .call(boxplot);
        });
    }

    iqr(k) {
        return function (d) {
            let q1 = d.quartiles[0],
                q3 = d.quartiles[2],
                iqr = (q3 - q1) * k,
                i = -1,
                j = d.length;
            while (d[++i] < q1 - iqr);
            while (d[--j] > q3 + iqr);
            return [i, j];
        };
    }

    rebuildLoomOptions() {
        let loomFiles = BackendAPI.getLoomFiles();
        this.loomConf = [];
        Object.keys(loomFiles).map((l) => {
            this.loomConf.push({
                text: loomFiles[l].loomDisplayName,
                value: l,
            });
        });
    }
}

export default DragDropContext(HTML5Backend)(Compare);
