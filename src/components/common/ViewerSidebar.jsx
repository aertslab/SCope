import _ from 'lodash';
import React, { Component, createRef } from 'react';
import { withRouter } from 'react-router-dom';
import {
    Header,
    Grid,
    Input,
    Icon,
    Tab,
    Label,
    Button,
    Progress,
    Popup,
} from 'semantic-ui-react';

import ReactGA from 'react-ga';
import Alert from 'react-popup';
import * as R from 'ramda';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';

import fileDownload from 'js-file-download';
import { parse as json2csv } from 'json2csv';

import { BackendAPI } from '../common/API';
import Metadata from '../common/Metadata';
import FileDownloader from '../../js/http';
import CollaborativeAnnotation from './CollaborativeAnnotation';
import GProfilerModal from '../GProfiler/GProfilerModal';
import ClusterOverlapsTable from './ClusterOverlapsTable';

class ViewerSidebar extends Component {
    static propTypes = {
        cookies: instanceOf(Cookies).isRequired,
    };

    constructor() {
        super();
        this.state = {
            activePage: BackendAPI.getActivePage(),
            activeLoom: BackendAPI.getActiveLoom(),
            activeFeatures: BackendAPI.getActiveFeatures(),
            lassoSelections: BackendAPI.getViewerSelections(),
            modalID: null,
            newAnnoName: '',
            newAnnoRef: createRef(),
            activeTab: 0,
            processSubLoomPercentage: null,
            downloadSubLoomPercentage: null,
            imageErrored: false,
            status: 'ready',
        };
        this.selectionsListener = (selections) => {
            this.setState({ lassoSelections: selections, activeTab: 0 });
        };
        this.activeFeaturesListener = (features, id) => {
            this.props.onActiveFeaturesChange(features, id);
            this.setState({
                activeFeatures: features,
                activeTab: parseInt(id) + 1,
            });
        };
        this.setNewAnnotationName.bind(this);
        this.onNewAnnotationChange.bind(this);
    }

    onNewAnnotationChange = (e) => {
        this.setNewAnnotationName(e.target.value);
    };

    setNewAnnotationName = (newAnnoName) => {
        this.setState({ newAnnoName: newAnnoName });
    };

    gotoNextCluster = (i, direction) => {
        BackendAPI.getNextCluster(
            this.state.activeFeatures[i].metadata['clusteringID'],
            this.state.activeFeatures[i].metadata['clusterID'],
            direction,
            (response) => {
                BackendAPI.updateFeature(
                    i,
                    response.featureType[0],
                    response.feature[0],
                    response.featureType[0],
                    response.featureDescription[0],
                    this.props.match.params.page,
                    (e) => {}
                );
            }
        );
    };

    updateMetadata = () => {
        BackendAPI.queryLoomFiles(
            this.props.match.params.uuid,
            () => {
                BackendAPI.getActiveFeatures().forEach((f, n) => {
                    BackendAPI.updateFeature(
                        n,
                        f.type,
                        f.feature,
                        f.featureType,
                        f.metadata ? f.metadata.description : null,
                        ''
                    );
                });
            },
            this.state.activeLoom
        );
    };

    getButtonText = (text) => {
        switch (this.state.status) {
            case 'ready':
                switch (button) {
                    case 'submit':
                        return (
                            <React.Fragment>
                                Submit Annotation <Icon name='right chevron' />
                            </React.Fragment>
                        );
                    case 'submitNext':
                        return (
                            <React.Fragment>
                                Submit and view next cluster{' '}
                                <Icon name='right chevron' />
                            </React.Fragment>
                        );
                    default:
                        return (
                            <React.Fragment>
                                Submit Annotation <Icon name='right chevron' />
                            </React.Fragment>
                        );
                }
            case 'processing':
                return (
                    <React.Fragment>
                        <Icon loading name='spinner' />
                    </React.Fragment>
                );
            default:
                return (
                    <React.Fragment>
                        Submit Annotation <Icon name='chevron right' />
                    </React.Fragment>
                );
        }
    };

    render() {
        const { history, match, hideFeatures } = this.props;
        const {
            lassoSelections,
            activeFeatures,
            activeTab,
            activePage,
        } = this.state;

        let lassoTab = () => {
            if (lassoSelections.length == 0) {
                return (
                    <Tab.Pane attached={false} style={{ textAlign: 'center' }}>
                        <br />
                        <br />
                        No user&apos;s lasso selections
                        <br />
                        <br />
                        <br />
                    </Tab.Pane>
                );
            }

            return lassoSelections.map((lS, i) => {
                return (
                    <Tab.Pane
                        attached={false}
                        style={{ textAlign: 'center' }}
                        key={i}>
                        <Grid>
                            <Grid.Row
                                columns={3}
                                key={i}
                                className='selectionRow'>
                                <Grid.Column style={{ whiteSpace: 'unset' }}>
                                    {`Selection ${lS.id + 1} (${
                                        lS.points.length
                                    } cells)`}
                                </Grid.Column>
                                <Grid.Column>
                                    <Input
                                        size='mini'
                                        style={{ width: 75, height: 15 }}
                                        label={{
                                            style: {
                                                backgroundColor: '#' + lS.color,
                                            },
                                        }}
                                        labelPosition='right'
                                        placeholder={'#' + lS.color}
                                        disabled
                                    />
                                </Grid.Column>
                                <Grid.Column>
                                    <Icon
                                        name='eye'
                                        title='toggle show/hide selection'
                                        onClick={(e, d) =>
                                            this.toggleLassoSelection(lS.id)
                                        }
                                        style={{
                                            display: 'inline',
                                            opacity: lS.selected ? 1 : 0.5,
                                        }}
                                        className='pointer'
                                    />
                                    &nbsp;
                                    <Icon
                                        name='trash'
                                        title='remove this selection'
                                        style={{ display: 'inline' }}
                                        onClick={(e, d) =>
                                            this.removeLassoSelection(i)
                                        }
                                        className='pointer'
                                    />
                                    &nbsp;
                                    <Icon
                                        name='search'
                                        title='show metadata for this selection'
                                        style={{ display: 'inline' }}
                                        onClick={(e, d) => {
                                            this.setState({ modalID: i });
                                            this.forceUpdate();
                                            ReactGA.event({
                                                category: 'metadata',
                                                action: 'modal opened',
                                                value: i,
                                            });
                                        }}
                                        className='pointer'
                                    />
                                </Grid.Column>
                            </Grid.Row>
                            <Grid.Row>
                                <Grid.Column>
                                    {lS.clusterOverlaps ? (
                                        <ClusterOverlapsTable
                                            clusterOverlaps={lS.clusterOverlaps}
                                        />
                                    ) : (
                                        ''
                                    )}
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                        <br />
                    </Tab.Pane>
                );
            });
        };

        let featureTab = (i) => {
            let colors = ['red', 'green', 'blue'];
            let metadata =
                activeFeatures[i] && activeFeatures[i].feature ? (
                    ''
                ) : (
                    <div>
                        No additional information shown for the feature queried
                        in the <b style={{ color: colors[i] }}>{colors[i]}</b>{' '}
                        query box because it is empty. Additional information
                        (e.g.: cluster markers, regulon motif, regulon target
                        genes, ...) can be displayed here when querying clusters
                        or regulons.
                        <br />
                        <br />
                    </div>
                );
            if (activeFeatures[i] && activeFeatures[i].metadata) {
                let image = '';
                let md = activeFeatures[i].metadata;
                if (md.motifName != 'NA.png' && !this.state.imageErrored) {
                    if (this.state.imageErrored) {
                        image = md.motifName ? (
                            <img
                                src={
                                    'http://motifcollections.aertslab.org/v8/logos/' +
                                    md.motifName
                                }
                            />
                        ) : (
                            ''
                        );
                        this.setState({ imageErrored: true });
                    } else {
                        image = md.motifName ? (
                            <img
                                src={
                                    'http://motifcollections.aertslab.org/v9/logos/' +
                                    md.motifName
                                }
                            />
                        ) : (
                            ''
                        );
                    }
                }

                this.handleAnnoUpdate = (feature, i) => {
                    if (this.state.newAnnoName != '') {
                        Alert.create({
                            title: 'BETA: Annotation Change!',
                            content: (
                                <p>
                                    {[
                                        'You are about to ',
                                        <b>permanently</b>,
                                        ' update the annotation of the existing cluster: ',
                                        <br />,
                                        <b>{feature.feature}</b>,
                                        <br />,
                                        'to the following: ',
                                        <br />,
                                        <b>{this.state.newAnnoName}</b>,
                                        <br />,
                                        <br />,
                                        <b>
                                            {' '}
                                            BETA: Some SCope functionality may
                                            be imparied until the loom is
                                            reloaded
                                        </b>,
                                    ]}
                                </p>
                            ),
                            buttons: {
                                left: [
                                    {
                                        text: 'Cancel',
                                        className: 'danger',
                                        action: function () {
                                            Alert.close();
                                        },
                                    },
                                ],
                                right: [
                                    {
                                        text: 'Save new annotation',
                                        className: 'success',
                                        action: () => {
                                            BackendAPI.setAnnotationName(
                                                feature,
                                                this.state.newAnnoName,
                                                i,
                                                this.props.match.params.uuid
                                            );
                                            Alert.close();
                                        },
                                    },
                                ],
                            },
                        });
                    }
                    if (this.state.newAnnoName === '') {
                        Alert.alert('You must enter a new annotation');
                    }
                };

                let annotationBox = () => {
                    if (
                        activeFeatures[i].featureType.startsWith('Cluster') &&
                        activeFeatures[i].feature != 'All Clusters' &&
                        BackendAPI.getLoomRWStatus() == 'rw' &&
                        this.state.activePage == 'gene'
                    ) {
                        return (
                            <Input
                                ref={this.state.newAnnoRef}
                                style={{
                                    marginBottom: '5px',
                                    width: '100%',
                                }}
                                placeholder={activeFeatures[i].feature}
                                onChange={this.onNewAnnotationChange}
                                actionPosition='left'
                                action={{
                                    onClick: () => {
                                        this.handleAnnoUpdate(
                                            activeFeatures[i],
                                            i
                                        );
                                    },
                                    'data-tooltip':
                                        'PERMANENT CHANGE and forces refresh!',
                                    'data-variation': 'basic',
                                    'data-position': 'left center',
                                    content: 'Update Description',
                                }}
                                value={this.state.newAnnoName}
                            />
                        );
                    }
                };

                let clusterControls = () => {
                    if (
                        activeFeatures[i].featureType.startsWith('Cluster') &&
                        activeFeatures[i].feature != 'All Clusters' &&
                        BackendAPI.getLoomRWStatus() == 'rw' &&
                        this.state.activePage == 'gene'
                    ) {
                        return (
                            <Grid>
                                <Grid.Row centered>
                                    <Header as='h3' textAlign='center'>
                                        Cluster Controls
                                    </Header>
                                </Grid.Row>
                                <Grid.Row>{annotationBox()}</Grid.Row>
                                <Grid.Row>
                                    <Button
                                        onClick={() =>
                                            this.gotoNextCluster(i, 'previous')
                                        }
                                        className='change-cluster-button'>
                                        {
                                            <Icon name='long arrow alternate left' />
                                        }
                                        Previous
                                    </Button>
                                    <CollaborativeAnnotation
                                        feature={activeFeatures[i]}
                                        id={i}
                                    />
                                    <Button
                                        onClick={() =>
                                            this.gotoNextCluster(i, 'next')
                                        }
                                        className='change-cluster-button'>
                                        Next
                                        {
                                            <Icon name='long arrow alternate right' />
                                        }
                                    </Button>
                                </Grid.Row>
                            </Grid>
                        );
                    }
                };

                let markerTable = '',
                    legendTable = '',
                    cellTypeAnnoTable = '',
                    downloadSubLoomButton = () => '';

                let newMarkerTableColumn = (header, id, accessor, cell) => {
                    let column = {
                        Header: header,
                        id: id,
                    };
                    if (accessor != null) {
                        column['accessor'] = (d) => d[accessor];
                    }
                    if (cell != null) {
                        column['Cell'] = (props) => cell(props);
                    }
                    return column;
                };

                let newCellTypeAnnoColumn = (
                    header,
                    id,
                    accessor,
                    cell,
                    sortMethod
                ) => {
                    let column = {
                        Header: header,
                        id: id,
                    };

                    if (accessor != null) {
                        column['accessor'] = (d) => d[accessor];
                    }

                    if (cell != null) {
                        column['Cell'] = (props) => cell(props);
                    }
                    if (sortMethod !== null) {
                        column['sortMethod'] = sortMethod;
                    }
                    return column;
                };

                if (md.cellTypeAnno) {
                    if (md.cellTypeAnno.length > 0) {
                        let newCellTypeAnnoTableOboCell = (props) => {
                            let iriLink =
                                props.value.ols_iri == '' ? (
                                    <React.Fragment>
                                        {props.value.annotation_label}
                                        <br />
                                        {props.value.obo_id
                                            ? '(' + props.value.obo_id + ')'
                                            : ''}
                                    </React.Fragment>
                                ) : (
                                    <a
                                        href={props.value.ols_iri}
                                        target='_blank'
                                        rel='noopener noreferrer'>
                                        {props.value.annotation_label}
                                        <br />
                                        {props.value.obo_id
                                            ? '(' + props.value.obo_id + ')'
                                            : ''}
                                    </a>
                                );

                            let popupInfo = (
                                <div>
                                    <Header as='h3'>
                                        Evidence provided for:&nbsp;{iriLink}
                                    </Header>
                                    <Header as='h4'>Markers</Header>
                                    {props.value.markers.length > 0
                                        ? props.value.markers
                                              .map((m) => m)
                                              .join(', ')
                                        : 'None provided'}
                                    <Header as='h4'>Publication</Header>
                                    {props.value.publication ? (
                                        <a href={props.value.publication}>
                                            {props.value.publication}
                                        </a>
                                    ) : (
                                        'None provided'
                                    )}
                                    <Header as='h4'>Comment</Header>
                                    {props.value.comment
                                        ? props.value.comment
                                        : 'None provided'}
                                </div>
                            );

                            return (
                                <div style={{ textAlign: 'center' }}>
                                    {iriLink}
                                    <br />
                                    <Popup
                                        trigger={
                                            <Label>
                                                <Icon name='question circle' />
                                                More Info
                                            </Label>
                                        }
                                        content={popupInfo}
                                        on='click'
                                    />
                                </div>
                            );
                        };

                        let newCellTypeAnnoTableCuratorCell = (props) => {
                            // Match 4 sets of 4 digits, hyphen seperated with an X as a possible final check digit
                            let orcidIDRegex = /(?:\d{4}-){3}\d{3}[0-9,X]/;

                            let iconName,
                                iconColor,
                                popupText = '';

                            if (
                                props.value.validated &
                                orcidIDRegex.test(props.value.curator_id)
                            ) {
                                iconName = 'check circle outline';
                                iconColor = 'green';
                                popupText =
                                    'This annotation was generated on this site.';
                            } else if (
                                orcidIDRegex.test(props.value.curator_id)
                            ) {
                                iconName = 'times circle outline';
                                iconColor = 'red';
                                popupText =
                                    'This annotation was NOT generated on this site.';
                            } else {
                                iconName = 'laptop';
                                iconColor = 'orange';
                                popupText =
                                    'This annotation is not linked to an ORCID iD and is therefore likely a prediction from a tool.';
                            }

                            return (
                                <div style={{ textAlign: 'center' }}>
                                    {orcidIDRegex.test(
                                        props.value.curator_id
                                    ) ? (
                                        <a
                                            href={
                                                'https://orcid.org/' +
                                                props.value.curator_id
                                            }
                                            target='_blank'
                                            rel='noopener noreferrer'>
                                            {props.value.curator_name}&nbsp;
                                        </a>
                                    ) : (
                                        props.value.curator_name +
                                        (props.value.curator_id
                                            ? <br /> +
                                              '(' +
                                              props.value.curator_id +
                                              ')'
                                            : '')
                                    )}

                                    <Popup
                                        trigger={
                                            <Icon
                                                name={iconName}
                                                color={iconColor}
                                            />
                                        }
                                        content={popupText}
                                    />
                                </div>
                            );
                        };

                        let submitVote = (annoData, direction) => {
                            this.setState({ status: 'processing' });
                            BackendAPI.voteAnnotation(
                                direction,
                                annoData,
                                activeFeatures[i],
                                {
                                    orcidName: this.state.orcid_name,
                                    orcidID: this.state.orcid_id,
                                    orcidUUID: this.state.orcid_uuid,
                                },
                                match.params.uuid,
                                (response) => {
                                    console.log(response);
                                    this.setState({ status: 'ready' });
                                }
                            );
                        };

                        let newCellTypeAnnoTableVotesCell = (props) => {
                            return (
                                <React.Fragment>
                                    <Popup
                                        className='vote-tooltip'
                                        trigger={
                                            <Button
                                                disabled={
                                                    !(
                                                        this.state.status ===
                                                        'ready'
                                                    )
                                                }
                                                onClick={() =>
                                                    submitVote(
                                                        props.value.data,
                                                        'for'
                                                    )
                                                }
                                                icon='thumbs up outline'
                                                content={
                                                    this.state.status ==
                                                    'ready' ? (
                                                        props.value.votes_for
                                                            .total
                                                    ) : (
                                                        <Icon
                                                            loading
                                                            name='spinner'
                                                        />
                                                    )
                                                }
                                            />
                                        }
                                        content={
                                            props.value.votes_for.voters
                                                .length > 0
                                                ? props.value.votes_for.voters.map(
                                                      (v, i) => (
                                                          <font
                                                              color={
                                                                  v.voter_hash
                                                                      ? 'green'
                                                                      : 'red'
                                                              }>
                                                              {'' +
                                                                  v.voter_name}
                                                              &nbsp;&nbsp;
                                                          </font>
                                                      )
                                                  )
                                                : 'None'
                                        }
                                    />
                                    <Popup
                                        className='vote-tooltip'
                                        trigger={
                                            <Button
                                                disabled={
                                                    !(
                                                        this.state.status ===
                                                        'ready'
                                                    )
                                                }
                                                onClick={() =>
                                                    submitVote(
                                                        props.value.data,
                                                        'against'
                                                    )
                                                }
                                                icon='thumbs down outline'
                                                content={
                                                    this.state.status ==
                                                    'ready' ? (
                                                        props.value
                                                            .votes_against.total
                                                    ) : (
                                                        <Icon
                                                            loading
                                                            name='spinner'
                                                        />
                                                    )
                                                }
                                            />
                                        }
                                        content={
                                            props.value.votes_against.voters
                                                .length > 0
                                                ? props.value.votes_against.voters.map(
                                                      (v) => (
                                                          <font
                                                              color={
                                                                  v.voter_hash
                                                                      ? 'green'
                                                                      : 'red'
                                                              }>
                                                              {v.voter_name}
                                                              &nbsp;&nbsp;
                                                          </font>
                                                      )
                                                  )
                                                : 'None'
                                        }
                                    />
                                </React.Fragment>
                            );
                        };

                        let cellTypeAnnoColumns = [
                            newCellTypeAnnoColumn(
                                <div>
                                    <nobr>Annotation/Ontology</nobr>
                                    <p>Term</p>
                                </div>,
                                'annotation',
                                'annotation',
                                newCellTypeAnnoTableOboCell,
                                R.comparator(
                                    (a, b) =>
                                        a.annotation_label < b.annotation_label
                                )
                            ),
                            newCellTypeAnnoColumn(
                                'Curator',
                                'orcid_info',
                                'orcid_info',
                                newCellTypeAnnoTableCuratorCell,
                                R.comparator(
                                    (a, b) => a.curator_name < b.curator_name
                                )
                            ),
                            newCellTypeAnnoColumn(
                                'Endorsements',
                                'votes',
                                'votes',
                                newCellTypeAnnoTableVotesCell,
                                R.comparator((a, b) => a.totVotes < b.totVotes)
                            ),
                        ];

                        let cellTypeAnnoTableData = md.cellTypeAnno.map(
                            (a, n) => {
                                let cellTypeAnnoTableRowData = {
                                    annotation: a.data,
                                    orcid_info: {
                                        curator_name: a.data.curator_name,
                                        curator_id: a.data.curator_id,
                                        validated: a.validate_hash,
                                    },
                                    votes: {
                                        votes_for: a.votes_for,
                                        votes_against: a.votes_against,
                                        totVotes:
                                            a.votes_for.total -
                                            a.votes_against.total,
                                        data: a.data,
                                    },
                                };
                                return cellTypeAnnoTableRowData;
                            }
                        );

                        let cellTypeAnnoTableHeight = screen.availHeight / 4;

                        let cellTypeAnnoTableHeaderName =
                            'Community Annotations';

                        cellTypeAnnoTable = (
                            <div
                                style={{
                                    marginBottom: '15px',
                                    align: 'center',
                                }}>
                                <ReactTable
                                    data={cellTypeAnnoTableData}
                                    columns={[
                                        {
                                            Header: cellTypeAnnoTableHeaderName,
                                            columns: cellTypeAnnoColumns,
                                        },
                                    ]}
                                    pageSizeOptions={[3]}
                                    defaultPageSize={3}
                                    // style={{
                                    // 	height: cellTypeAnnoTableHeight +"px" // This will force the table body to overflow and scroll, since there is not enough room
                                    // }}
                                    className='-striped -highlight'
                                />
                            </div>
                        );
                    } else {
                        cellTypeAnnoTable = (
                            <div
                                style={{
                                    marginBottom: '5px',
                                    align: 'center',
                                }}>
                                No annotations currently exist.{' '}
                                {BackendAPI.getLoomRWStatus() == 'rw'
                                    ? 'Be the first to contribute!'
                                    : ''}
                            </div>
                        );
                    }
                }

                if (md.genes) {
                    let newMarkerTableGeneCell = (props) => {
                        return (
                            <a
                                className='pointer'
                                onClick={() => {
                                    let query = {
                                        loomFilePath: BackendAPI.getActiveLoom(),
                                        query: props.value,
                                    };
                                    if (activePage == 'regulon') {
                                        this.setState({ currentPage: 'gene' });
                                        BackendAPI.setActivePage('gene');
                                        history.push(
                                            '/' +
                                                [
                                                    match.params.uuid,
                                                    match.params.loom
                                                        ? match.params.loom
                                                        : '*',
                                                    'gene',
                                                ].join('/')
                                        );
                                    }
                                    BackendAPI.getConnection().then(
                                        (gbc) => {
                                            gbc.services.scope.Main.getFeatures(
                                                query,
                                                (err, response) => {
                                                    BackendAPI.setActiveFeature(
                                                        i,
                                                        activeFeatures[i].type,
                                                        'gene',
                                                        props.value,
                                                        0,
                                                        {
                                                            description:
                                                                response
                                                                    .featureDescription[0],
                                                        }
                                                    );
                                                }
                                            );
                                        },
                                        () => {
                                            BackendAPI.showError();
                                        }
                                    );
                                    ReactGA.event({
                                        category: 'action',
                                        action: 'gene clicked',
                                        label: props.value,
                                        value: i,
                                    });
                                }}>
                                {props.value}
                            </a>
                        );
                    };

                    // Define the marker table columns
                    // Add at least the gene column
                    let markerTableColumns = [
                        newMarkerTableColumn(
                            'Gene Symbol',
                            'gene',
                            'gene',
                            newMarkerTableGeneCell
                        ),
                    ];

                    if ('metrics' in md) {
                        // Add extra columns (metrics like logFC, p-value, ...)
                        for (let metric of md.metrics) {
                            markerTableColumns = [
                                ...markerTableColumns,
                                newMarkerTableColumn(
                                    metric.name,
                                    metric.accessor,
                                    metric.accessor,
                                    null
                                ),
                            ];
                        }
                    }

                    let markerTableData = md.genes.map((g, j) => {
                        let markerTableRowData = { gene: g };
                        if (!('metrics' in md)) return markerTableRowData;
                        for (let metric of md.metrics)
                            markerTableRowData[metric.accessor] =
                                metric.values[j];
                        return markerTableRowData;
                    });

                    let markerTableHeight = screen.availHeight / 2.5;

                    let markerTableHeaderName = () => {
                            if (activeFeatures[i].featureType == 'regulon')
                                return 'Regulon Genes';
                            else if (
                                activeFeatures[i].featureType.startsWith(
                                    'Clustering'
                                )
                            )
                                return 'Cluster Markers';
                        },
                        downloadButtonName = () => {
                            if (activeFeatures[i].featureType == 'regulon')
                                return (
                                    'Download ' +
                                    activeFeatures[i].feature +
                                    ' regulon genes'
                                );
                            else if (
                                activeFeatures[i].featureType.startsWith(
                                    'Clustering'
                                )
                            )
                                return (
                                    'Download ' +
                                    activeFeatures[i].feature +
                                    ' markers'
                                );
                        },
                        genesFileName = () => {
                            if (activeFeatures[i].featureType == 'regulon')
                                return (
                                    activeFeatures[i].feature +
                                    '_regulon_genes.tsv'
                                );
                            else if (
                                activeFeatures[i].featureType.startsWith(
                                    'Clustering'
                                )
                            )
                                return (
                                    activeFeatures[i].feature + '_markers.tsv'
                                );
                        };

                    markerTable = (
                        <div style={{ marginBottom: '15px', align: 'center' }}>
                            <ReactTable
                                data={markerTableData}
                                columns={[
                                    {
                                        Header: markerTableHeaderName(),
                                        columns: markerTableColumns,
                                    },
                                ]}
                                pageSizeOptions={[5, 10, 25, 50, 100]}
                                defaultPageSize={25}
                                style={{
                                    height: markerTableHeight + 'px', // This will force the table body to overflow and scroll, since there is not enough room
                                }}
                                className='-striped -highlight'
                            />
                            <Button
                                primary
                                onClick={() => {
                                    const tsv = json2csv(markerTableData, {
                                        delimiter: '\t',
                                        quote: '',
                                    });
                                    fileDownload(tsv, genesFileName());
                                }}
                                style={{ marginTop: '10px', width: '100%' }}>
                                {downloadButtonName()}
                            </Button>
                        </div>
                    );
                }

                if (
                    (this.props.activeLegend != null) &
                    (activeFeatures[i].featureType == 'annotation' ||
                        activeFeatures[i].feature == 'All Clusters')
                ) {
                    let aL = this.props.activeLegend;
                    let legendTableData = aL.values.map((v, j) => ({
                        value: v,
                        color: aL.colors[j],
                    }));
                    let newLegendTableColorCell = (props) => {
                        let colorLegendStyle = {
                            width: '25px',
                            height: '25px',
                            '-webkit-mask-box-image':
                                "url('src/images/dot.png')",
                            backgroundColor: '#' + props.value,
                        };
                        return <div style={colorLegendStyle}></div>;
                    };
                    let legendTableColumns = [
                        newMarkerTableColumn('Value', 'value', 'value', null),
                        newMarkerTableColumn(
                            'Color',
                            'color',
                            'color',
                            newLegendTableColorCell
                        ),
                    ];
                    legendTable = (
                        <div style={{ marginBottom: '15px' }}>
                            <ReactTable
                                data={legendTableData}
                                columns={[
                                    {
                                        Header: 'Legend',
                                        columns: legendTableColumns,
                                    },
                                ]}
                                pageSizeOptions={[5, 10, 20]}
                                defaultPageSize={10}
                                className='-striped -highlight'
                            />
                        </div>
                    );
                }

                if (activeFeatures[i].featureType.startsWith('Clustering')) {
                    downloadSubLoomButton = () => {
                        if (
                            this.state.downloadSubLoomPercentage == null &&
                            this.state.processSubLoomPercentage == null
                        )
                            return (
                                <Button
                                    color='green'
                                    onClick={() => {
                                        let query = {
                                            loomFilePath: BackendAPI.getActiveLoom(),
                                            featureType: 'clusterings',
                                            featureName: activeFeatures[
                                                i
                                            ].featureType.replace(
                                                /Clustering: /g,
                                                ''
                                            ),
                                            featureValue:
                                                activeFeatures[i].feature,
                                            operator: '==',
                                        };
                                        BackendAPI.getConnection().then(
                                            (gbc) => {
                                                if (DEBUG)
                                                    console.log(
                                                        'Download subset of active .loom'
                                                    );
                                                let call = gbc.services.scope.Main.downloadSubLoom(
                                                    query
                                                );
                                                call.on('data', (dsl) => {
                                                    if (DEBUG)
                                                        console.log(
                                                            'downloadSubLoom data'
                                                        );
                                                    if (dsl == null) {
                                                        this.setState({
                                                            loomDownloading: null,
                                                            downloadSubLoomPercentage: null,
                                                        });
                                                        return;
                                                    }
                                                    if (!dsl.isDone) {
                                                        this.setState({
                                                            processSubLoomPercentage: Math.round(
                                                                dsl.progress
                                                                    .value * 100
                                                            ),
                                                        });
                                                    } else {
                                                        // Start downloading the subsetted loom file
                                                        let fd = new FileDownloader(
                                                            dsl.loomFilePath,
                                                            match.params.uuid,
                                                            dsl.loomFileSize
                                                        );
                                                        fd.on(
                                                            'started',
                                                            (isStarted) => {
                                                                this.setState({
                                                                    processSubLoomPercentage: null,
                                                                    loomDownloading: encodeURIComponent(
                                                                        dsl.loomFilePath
                                                                    ),
                                                                });
                                                            }
                                                        );
                                                        fd.on(
                                                            'progress',
                                                            (progress) => {
                                                                this.setState({
                                                                    downloadSubLoomPercentage: progress,
                                                                });
                                                            }
                                                        );
                                                        fd.on(
                                                            'finished',
                                                            (finished) => {
                                                                this.setState({
                                                                    loomDownloading: null,
                                                                    downloadSubLoomPercentage: null,
                                                                });
                                                            }
                                                        );
                                                        fd.start();
                                                    }
                                                });
                                                call.on('end', () => {
                                                    console.log();
                                                    if (DEBUG)
                                                        console.log(
                                                            'downloadSubLoom end'
                                                        );
                                                });
                                            },
                                            () => {
                                                this.setState({
                                                    loomDownloading: null,
                                                    downloadSubLoomPercentage: null,
                                                    processSubLoomPercentage: null,
                                                });
                                                BackendAPI.showError();
                                            }
                                        );
                                    }}
                                    style={{
                                        marginTop: '10px',
                                        width: '100%',
                                    }}>
                                    {'Download ' +
                                        activeFeatures[i].feature +
                                        ' .loom file'}
                                </Button>
                            );
                        if (this.state.processSubLoomPercentage > 0)
                            return (
                                <Progress
                                    percent={
                                        this.state.processSubLoomPercentage
                                    }
                                    indicating
                                    progress
                                    disabled
                                    size='large'>
                                    Processing...
                                </Progress>
                            );
                        if (this.state.downloadSubLoomPercentage > 0)
                            return (
                                <Progress
                                    percent={
                                        this.state.downloadSubLoomPercentage
                                    }
                                    indicating
                                    progress
                                    disabled
                                    size='large'>
                                    Downloading...
                                </Progress>
                            );
                    };
                }
                metadata = (
                    <Grid.Row columns='1' centered className='viewerRow'>
                        <Grid.Column stretched className='viewerCell'>
                            {md.featureType}{' '}
                            {activeFeatures[i].featureType.startsWith(
                                'Clustering'
                            ) && `Group: ${md.clusteringGroup}`}{' '}
                            {md.feature}
                            <br />
                            {image}
                            {clusterControls()}
                            {/* {annotationBox()} */}
                            {cellTypeAnnoTable}
                            {markerTable}
                            {legendTable}
                            {downloadSubLoomButton()}
                            {activeFeatures[i].featureType.startsWith(
                                'Clustering'
                            ) && <GProfilerModal featureMetadata={md} />}
                            <br />
                        </Grid.Column>
                    </Grid.Row>
                );
            }

            return (
                <Tab.Pane
                    attached={false}
                    key={i}
                    className={'feature' + i + ' stretched marginBottom'}
                    style={{ textAlign: 'center' }}>
                    <Grid>
                        <Grid.Row columns='1' centered className='viewerRow'>
                            <Grid.Column className='viewerCell'>
                                {activeFeatures[i]
                                    ? activeFeatures[i].featureType
                                    : ''}{' '}
                                <b>
                                    {' '}
                                    {activeFeatures[i]
                                        ? activeFeatures[i].feature
                                        : ''}{' '}
                                </b>
                            </Grid.Column>
                        </Grid.Row>
                        {metadata}
                    </Grid>
                </Tab.Pane>
            );
        };

        let panes = [{ menuItem: 'Cell selections', render: lassoTab }];
        if (!hideFeatures) {
            _.times(3, (i) => {
                panes.push({
                    menuItem:
                        activeFeatures[i] && activeFeatures[i].feature
                            ? 'F' + (i + 1) + ': ' + activeFeatures[i].feature
                            : 'F' + (i + 1),
                    render: () => featureTab(i),
                });
            });
        }

        let annotations = {};
        if (this.props.getSelectedAnnotations) {
            annotations = this.props.getSelectedAnnotations();
        }

        return (
            <div className='flexDisplay'>
                <Tab
                    menu={{ secondary: true, pointing: true }}
                    panes={panes}
                    renderActiveOnly={true}
                    activeIndex={activeTab}
                    className='sidebarTabs'
                    onTabChange={(evt, data) => {
                        this.setState({ activeTab: data.activeIndex });
                    }}
                />
                <Metadata
                    selectionId={this.state.modalID}
                    onClose={() => {
                        ReactGA.event({
                            category: 'metadata',
                            action: 'modal closed',
                            value: this.state.modalID,
                        });
                        this.setState({ modalID: null });
                        this.forceUpdate();
                    }}
                    annotations={Object.keys(annotations)}
                />
            </div>
        );
    }

    UNSAFE_componentWillMount() {
        let orcid_name = this.props.cookies.get('scope_orcid_name');
        let orcid_id = this.props.cookies.get('scope_orcid_id');
        let orcid_uuid = this.props.cookies.get('scope_orcid_uuid');

        this.setState({
            orcid_name: orcid_name,
            orcid_id: orcid_id,
            orcid_uuid: orcid_uuid,
        });
        this.timer = null;
        BackendAPI.onViewerSelectionsChange(this.selectionsListener);
        BackendAPI.onActiveFeaturesChange(
            this.state.activePage,
            this.activeFeaturesListener
        );
    }

    componentWillUnmount() {
        BackendAPI.removeViewerSelectionsChange(this.selectionsListener);
        BackendAPI.removeActiveFeaturesChange(
            this.state.activePage,
            this.activeFeaturesListener
        );
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.match.params.loom != prevProps.match.params.loom) {
            this.updateMetadata();
        }
    }

    toggleLassoSelection(id) {
        let selected = BackendAPI.toggleLassoSelection(id);
        ReactGA.event({
            category: 'viewer',
            action: 'selection toggled',
            label: selected ? 'on' : 'off',
            value: id,
        });
    }

    removeLassoSelection(id) {
        BackendAPI.removeViewerSelection(id);
        ReactGA.event({
            category: 'viewer',
            action: 'selection removed',
            value: id,
        });
    }
}
export default withCookies(withRouter(ViewerSidebar));
