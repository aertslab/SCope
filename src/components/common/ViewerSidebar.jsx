import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { Tab } from 'semantic-ui-react';

import 'react-table/react-table.css';
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';

import { BackendAPI } from '../common/API';
import Metadata from '../common/Metadata';
import LassoControls from '../LassoControls';
import QueryFeatureTab from '../QueryFeatureTool/QueryFeatureTab';

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

    render() {
        const { history, hideFeatures } = this.props;
        const { lassoSelections, activeFeatures, activeTab, activePage } =
            this.state;

        let panes = [
            {
                menuItem: 'Cell selections',
                render: () => <LassoControls selections={lassoSelections} />,
            },
        ];
        if (!hideFeatures) {
            [0, 1, 2].map((i) => {
                panes.push({
                    menuItem:
                        activeFeatures[i] && activeFeatures[i].feature
                            ? 'F' + (i + 1) + ': ' + activeFeatures[i].feature
                            : 'F' + (i + 1),
                    render: () => (
                        <QueryFeatureTab
                            history={history}
                            activePage={activePage}
                            activeFeature={activeFeatures[i]}
                            activeFeatureIndex={i}
                        />
                    ),
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
