import React, { Component } from 'react';
import { Segment, Grid } from 'semantic-ui-react';

import './pages.css';

import { FEATURE_COLOURS } from '../constants';

import Search from '../Search';
import { BackendAPI } from '../common/API';
import Viewer from '../common/Viewer';
import RightSidebar from '../RightSidebar';
import ViewerToolbar from '../common/ViewerToolbar';
import Histogram from '../Histogram';

import { Metadata, Feature } from '../../model';

type RegulonState = {
    activeLoom: string;
    activeEmbeddingId: number;
    activeFeatures: Feature[];
};

export default class Regulon extends Component<any, RegulonState> {
    activeLoomListener: (
        _loom: string,
        _metadata: Metadata,
        _embeddingId: number
    ) => void;
    activeFeaturesListener: (_features: Feature[]) => void;

    constructor(props) {
        super(props);
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeEmbeddingId: BackendAPI.getActiveEmbeddingId(),
            activeFeatures: BackendAPI.getActiveFeatures(),
        };
        this.activeLoomListener = (
            loom: string,
            metadata: Metadata,
            embeddingId: number
        ) => {
            this.setState({ activeLoom: loom, activeEmbeddingId: embeddingId });
        };
        this.activeFeaturesListener = (features: Feature[]) => {
            this.setState({ activeFeatures: features });
        };
    }

    render() {
        const { activeLoom, activeEmbeddingId, activeFeatures } = this.state;

        const featureThreshold = [0, 1, 2].map((i) => (
            <Grid.Column key={i} className='flexDisplay' stretched>
                <Histogram
                    field={i}
                    color={FEATURE_COLOURS[i]}
                    loomFile={activeLoom}
                    feature={activeFeatures[i]}
                    onThresholdChange={this.onThresholdChange.bind(this)}
                />
            </Grid.Column>
        ));

        if (!activeLoom) {
            return <div>Select the dataset to be analyzed</div>;
        }

        return (
            <div
                className='appPage'
                style={{
                    height: '100%',
                    width: '100%',
                }}>
                <Search.FeatureSearchGroup
                    filter='regulon'
                    identifier='regulon-page'
                />
                <Grid className='flexDisplay'>
                    <Grid.Row columns='3' centered>
                        {featureThreshold}
                        <Grid.Column>&nbsp;</Grid.Column>
                    </Grid.Row>
                </Grid>
                <div
                    style={{
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'row',
                    }}>
                    <div style={{ width: '78px', paddingTop: '45px' }}>
                        <ViewerToolbar location={this.props.location} />
                    </div>
                    <div style={{ flexGrow: 1, paddingTop: '45px' }}>
                        <Grid
                            className='flexDisplay'
                            style={{ height: '100%' }}>
                            <Grid.Row
                                columns='3'
                                className='viewerFlex flexRow'>
                                <b className='viewerLabel'>
                                    Regulon AUC values
                                </b>
                                <Grid.Column className='flexDouble'>
                                    <Viewer
                                        name='reg'
                                        loomFile={activeLoom}
                                        activeFeatures={activeFeatures}
                                        activeEmbeddingId={activeEmbeddingId}
                                        scale={true}
                                        location={this.props.location}
                                    />
                                </Grid.Column>
                                <Grid.Column stretched>
                                    <Segment
                                        vertical
                                        stretched
                                        className='flexDisplay'>
                                        <b className='viewerLabel'>
                                            Cells passing thresholds
                                        </b>
                                        <Viewer
                                            name='auc'
                                            loomFile={activeLoom}
                                            activeFeatures={activeFeatures}
                                            activeEmbeddingId={
                                                activeEmbeddingId
                                            }
                                            thresholds={true}
                                            location={this.props.location}
                                        />
                                    </Segment>
                                    <Segment
                                        vertical
                                        stretched
                                        className='flexDisplay'>
                                        <b className='viewerLabel'>
                                            Expression levels
                                        </b>
                                        <Viewer
                                            name='expr'
                                            loomFile={activeLoom}
                                            activeFeatures={activeFeatures}
                                            activeEmbeddingId={
                                                activeEmbeddingId
                                            }
                                            scale={true}
                                            genes={true}
                                            settings={true}
                                            customScale={true}
                                            location={this.props.location}
                                        />
                                    </Segment>
                                </Grid.Column>
                                <Grid.Column>
                                    <RightSidebar
                                        onActiveFeaturesChange={(features) => {
                                            this.setState({
                                                activeFeatures: features,
                                            });
                                        }}
                                        hideFeatures={false}
                                        activeLegend={true}
                                        getSelectedAnnotations={() => Object()}

                                    />
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                    </div>
                </div>
            </div>
        );
    }

    UNSAFE_componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
        BackendAPI.onActiveFeaturesChange(
            'regulon',
            this.activeFeaturesListener
        );
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeActiveFeaturesChange(
            'regulon',
            this.activeFeaturesListener
        );
    }

    onThresholdChange(idx: number, threshold: number) {
        BackendAPI.setFeatureThreshold(idx, threshold);
    }
}
