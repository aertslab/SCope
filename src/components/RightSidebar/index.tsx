import React, { Component } from 'react';
import { connect } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Tab } from 'semantic-ui-react';

import 'react-table/react-table.css';

import { BackendAPI } from '../common/API';
import Metadata from '../common/Metadata';
import LassoControls from '../LassoControls';
import QueryFeatureTab from '../QueryFeatureTool/QueryFeatureTab';

type RightSidebarProps = {
    hideFeatures: boolean;
    activeLegend: any;
    onActiveFeaturesChange: (features, id) => void;
    getSelectedAnnotations: () => Object;
    sessionIsRW: boolean;
} & RouteComponentProps<{ uuid: string; loom: string }>;

type RightSidebarState = {
    activePage: string;
    activeLoom: string;
    activeTab: string | number | undefined;
    activeFeatures: any[];
    lassoSelections: any[];
    modalID: string | null;
};

class RightSidebar extends Component<RightSidebarProps, RightSidebarState> {
    private selectionsListener: (selections: any) => void;
    private activeFeaturesListener: (features, id) => void;

    constructor(props: RightSidebarProps) {
        super(props);
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
            console.log('RightSidebar features changed:', features, id);
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
        const { history, hideFeatures, activeLegend, getSelectedAnnotations } =
            this.props;
        const { lassoSelections, activeFeatures, activeTab, activePage } =
            this.state;

        const panes = [
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
                            activeLegend={activeLegend}
                            activeFeature={activeFeatures[i]}
                            activeFeatureIndex={i}
                            sessionIsRW={this.props.sessionIsRW}
                        />
                    ),
                });
            });
        }

        let annotations = {};
        if (getSelectedAnnotations) {
            annotations = getSelectedAnnotations();
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
        const activePage = decodeURI(this.props.location.pathname)
            .split('/')
            .slice(-1)[0];
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

const mapStateToProps = (rootState) => {
    return {
        sessionIsRW: rootState.main.sessionMode === 'rw',
    };
};

export default connect(mapStateToProps)(withRouter(RightSidebar));
