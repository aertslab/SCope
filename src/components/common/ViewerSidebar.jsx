import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { Grid, Icon, Tab, Button, Progress, Popup } from 'semantic-ui-react';

import ReactTable from 'react-table';
import 'react-table/react-table.css';
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';

import { BackendAPI } from '../common/API';
import Metadata from '../common/Metadata';
import FileDownloader from '../../js/http';
import GProfilerModal from '../GProfiler/GProfilerModal';
import LassoControls from '../LassoControls';
import ClusterControls from '../ClusterControls';
import { EmptyFeatureDisplayMessage } from '../QueryFeatureTool/EmptyFeatureDisplayMessage';
import { MotifLogo } from '../MotifLogo';
import CommunityAnnotationTable from '../CommunityAnnotationTable';
import FeatureMarkerTable from '../FeatureMarkerTable';
import LegendTable from '../LegendTable';

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
            // TODO: should be put in the Redux global state
            modalID: null,
            activeTab: 0,
            processSubLoomPercentage: null,
            downloadSubLoomPercentage: null,
            status: 'ready',
        };
        this.selectionsListener = (selections) => {
            this.setState({ lassoSelections: selections, activeTab: 0 });
        };
        this.activeFeaturesListener = (features, id) => {
            this.props.onActiveFeaturesChange(features, id);
            console.log('ViewerSidebar features changed:', features, id);
            this.setState({
                activeFeatures: features,
                activeTab: parseInt(id) + 1,
            });
        };
    }

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
                switch (text) {
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
        const { lassoSelections, activeFeatures, activeTab, activePage } =
            this.state;

        let lassoTab = () => <LassoControls selections={lassoSelections} />;

        let featureTab = (i) => {
            let metadata = activeFeatures[i]?.feature ? (
                ''
            ) : (
                <EmptyFeatureDisplayMessage featureIndex={i} />
            );
            if (activeFeatures[i] && activeFeatures[i].metadata) {
                let md = activeFeatures[i].metadata;
                let image = activeFeatures[i].metadata?.motifName ? (
                    <MotifLogo
                        motifName={activeFeatures[i].metadata.motifName}
                    />
                ) : (
                    ''
                );

                let clusterControls = () => {
                    if (
                        activeFeatures[i].featureType.startsWith('Cluster') &&
                        activeFeatures[i].feature !== 'All Clusters' &&
                        this.props.sessionIsRW &&
                        this.state.activePage === 'gene'
                    ) {
                        return (
                            <ClusterControls
                                featureIndex={i}
                                feature={activeFeatures[i]}
                            />
                        );
                    }
                };

                let markerTable = '',
                    legendTable = '',
                    cellTypeAnnoTable = '',
                    downloadSubLoomButton = () => '';

                if (md.cellTypeAnno) {
                    cellTypeAnnoTable = (
                        <CommunityAnnotationTable
                            communityAnnotations={md.cellTypeAnno}
                            activeFeature={activeFeatures[i]}
                        />
                    );
                }

                if (md.genes) {
                    markerTable = (
                        <FeatureMarkerTable
                            history={history}
                            activePage={activePage}
                            metadata={md}
                            activeFeature={activeFeatures[i]}
                            activeFeatureIndex={i}
                        />
                    );
                }

                if (
                    (this.props.activeLegend !== null) &
                    (activeFeatures[i].featureType === 'annotation' ||
                        activeFeatures[i].feature === 'All Clusters')
                ) {
                    legendTable = (
                        <LegendTable activeLegend={this.props.activeLegend} />
                    );
                }

                if (activeFeatures[i].featureType.startsWith('Clustering')) {
                    downloadSubLoomButton = () => {
                        if (
                            this.state.downloadSubLoomPercentage === null &&
                            this.state.processSubLoomPercentage === null
                        ) {
                            return (
                                <Button
                                    color='green'
                                    onClick={() => {
                                        let query = {
                                            loomFilePath:
                                                BackendAPI.getActiveLoom(),
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
                                                if (DEBUG) {
                                                    console.log(
                                                        'Download subset of active .loom'
                                                    );
                                                }
                                                let call =
                                                    gbc.services.scope.Main.downloadSubLoom(
                                                        query
                                                    );
                                                call.on('data', (dsl) => {
                                                    if (DEBUG) {
                                                        console.log(
                                                            'downloadSubLoom data'
                                                        );
                                                    }
                                                    if (dsl === null) {
                                                        this.setState({
                                                            loomDownloading:
                                                                null,
                                                            downloadSubLoomPercentage:
                                                                null,
                                                        });
                                                        return;
                                                    }
                                                    if (!dsl.isDone) {
                                                        this.setState({
                                                            processSubLoomPercentage:
                                                                Math.round(
                                                                    dsl.progress
                                                                        .value *
                                                                        100
                                                                ),
                                                        });
                                                    } else {
                                                        // Start downloading the subsetted loom file
                                                        let fd =
                                                            new FileDownloader(
                                                                dsl.loomFilePath,
                                                                match.params.uuid,
                                                                dsl.loomFileSize
                                                            );
                                                        fd.on(
                                                            'started',
                                                            (isStarted) => {
                                                                this.setState({
                                                                    processSubLoomPercentage:
                                                                        null,
                                                                    loomDownloading:
                                                                        encodeURIComponent(
                                                                            dsl.loomFilePath
                                                                        ),
                                                                });
                                                            }
                                                        );
                                                        fd.on(
                                                            'progress',
                                                            (progress) => {
                                                                this.setState({
                                                                    downloadSubLoomPercentage:
                                                                        progress,
                                                                });
                                                            }
                                                        );
                                                        fd.on(
                                                            'finished',
                                                            (finished) => {
                                                                this.setState({
                                                                    loomDownloading:
                                                                        null,
                                                                    downloadSubLoomPercentage:
                                                                        null,
                                                                });
                                                            }
                                                        );
                                                        fd.start();
                                                    }
                                                });
                                                call.on('end', () => {
                                                    console.log();
                                                    if (DEBUG) {
                                                        console.log(
                                                            'downloadSubLoom end'
                                                        );
                                                    }
                                                });
                                            },
                                            () => {
                                                this.setState({
                                                    loomDownloading: null,
                                                    downloadSubLoomPercentage:
                                                        null,
                                                    processSubLoomPercentage:
                                                        null,
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
                        }
                        if (this.state.processSubLoomPercentage > 0) {
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
                        }
                        if (this.state.downloadSubLoomPercentage > 0) {
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
                        }
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
                            {cellTypeAnnoTable}
                            {markerTable}
                            {legendTable}
                            {downloadSubLoomButton()}
                            {(activeFeatures[i].featureType.startsWith(
                                'Clustering'
                            ) ||
                                activeFeatures[i].featureType === 'regulon') &&
                                md.genes && (
                                    <GProfilerModal featureMetadata={md} />
                                )}
                            <br />
                        </Grid.Column>
                    </Grid.Row>
                );
            }

            return (
                <Tab.Pane
                    attached={false}
                    key={i}
                    className={
                        'feature' + i + ' stretched marginBottom tabView'
                    }>
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
            [0, 1, 2].map((i) => {
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
                    menu={{
                        secondary: true,
                        pointing: true,
                        stackable: true,
                        widths: 4,
                    }}
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
                        this.setState({ modalID: null });
                        this.forceUpdate();
                    }}
                    annotations={Object.keys(annotations)}
                />
            </div>
        );
    }

    componentDidMount() {
        let orcid_name = this.props.cookies.get('scope_orcid_name');
        let orcid_id = this.props.cookies.get('scope_orcid_id');
        let orcid_uuid = this.props.cookies.get('scope_orcid_uuid');
        const activePage = decodeURI(this.props.location.pathname)
            .split('/')
            .slice(-1)[0];

        this.setState({
            orcid_name: orcid_name,
            orcid_id: orcid_id,
            orcid_uuid: orcid_uuid,
            activePage,
        });
        this.timer = null;
        BackendAPI.onViewerSelectionsChange(this.selectionsListener);

        BackendAPI.onActiveFeaturesChange(
            activePage,
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
        if (this.props.match.params.loom !== prevProps.match.params.loom) {
            this.updateMetadata();
        }
    }
}

const viewerSidebar = withCookies(withRouter(ViewerSidebar));

const mapStateToProps = (rootState) => {
    return {
        sessionIsRW: rootState.main.sessionMode === 'rw',
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelection: (field, selection) =>
            dispatch(SearchAction.select(field, selection)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(viewerSidebar);
