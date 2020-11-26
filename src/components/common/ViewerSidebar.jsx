import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { Grid, Tab } from 'semantic-ui-react';

import 'react-table/react-table.css';
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';

import { BackendAPI } from '../common/API';
import Metadata from '../common/Metadata';
import GProfilerModal from '../GProfiler/GProfilerModal';
import LassoControls from '../LassoControls';
import ClusterControls from '../ClusterControls';
import { EmptyFeatureDisplayMessage } from '../QueryFeatureTool/EmptyFeatureDisplayMessage';
import { MotifLogo } from '../MotifLogo';
import CommunityAnnotationTable from '../CommunityAnnotationTable';
import FeatureMarkerTable from '../FeatureMarkerTable';
import LegendTable from '../LegendTable';
import DownloadLoomButton from '../buttons/DownloadLoomButton';

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
                        activeFeatures[i].feature != 'All Clusters' &&
                        BackendAPI.getLoomRWStatus() == 'rw' &&
                        this.state.activePage == 'gene'
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
        if (this.props.match.params.loom != prevProps.match.params.loom) {
            this.updateMetadata();
        }
    }
}
export default withCookies(withRouter(ViewerSidebar));
