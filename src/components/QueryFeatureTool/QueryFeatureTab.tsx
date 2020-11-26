import React from 'react';
import { Grid, Tab } from 'semantic-ui-react';
import { BackendAPI } from '../common/API';

import GProfilerModal from '../GProfiler/GProfilerModal';
import ClusterControls from '../ClusterControls';
import { EmptyFeatureDisplayMessage } from '../QueryFeatureTool/EmptyFeatureDisplayMessage';
import { MotifLogo } from '../MotifLogo';
import CommunityAnnotationTable from '../CommunityAnnotationTable';
import FeatureMarkerTable from '../FeatureMarkerTable';
import LegendTable from '../LegendTable';
import DownloadLoomButton from '../buttons/DownloadLoomButton';

type QueryFeatureTabProps = {
    history: any;
    activeFeature: any;
    activeFeatureIndex: number;
    activePage: any;
    activeLegend: any;
};

export class QueryFeatureTab extends React.Component<QueryFeatureTabProps> {
    constructor(props: QueryFeatureTabProps) {
        super(props);
    }

    showMotifLogo() {
        const { activeFeature } = this.props;
        return activeFeature.metadata?.motifName;
    }

    showClusterControls() {
        const { activePage, activeFeature } = this.props;
        return (
            activeFeature.featureType.startsWith('Cluster') &&
            activeFeature.feature != 'All Clusters' &&
            BackendAPI.getLoomRWStatus() == 'rw' &&
            activePage == 'gene'
        );
    }

    showCommunityAnnotationTable() {
        const { activeFeature } = this.props;
        return activeFeature.metadata?.cellTypeAnno;
    }

    showFeatureMarkerTable() {
        const { activeFeature } = this.props;
        return activeFeature.metadata?.genes;
    }

    showLegendTable() {
        const { activeFeature } = this.props;
        return (
            this.props.activeLegend != null &&
            (activeFeature.featureType == 'annotation' ||
                activeFeature.feature == 'All Clusters')
        );
    }

    showDownloadLoomButton() {
        const { activeFeature } = this.props;
        return activeFeature.featureType.startsWith('Clustering');
    }

    showGProfilerModal() {
        const { activeFeature } = this.props;
        return activeFeature.featureType.startsWith('Clustering');
    }

    render() {
        const {
            history,
            activePage,
            activeFeature,
            activeFeatureIndex,
        } = this.props;
        let metadata = activeFeature?.feature ? (
            ''
        ) : (
            <EmptyFeatureDisplayMessage featureIndex={activeFeatureIndex} />
        );
        if (activeFeature && activeFeature.metadata) {
            let md = activeFeature.metadata;

            metadata = (
                <Grid.Row columns='1' centered className='viewerRow'>
                    <Grid.Column stretched className='viewerCell'>
                        {md.featureType}{' '}
                        {activeFeature.featureType.startsWith('Clustering') &&
                            `Group: ${md.clusteringGroup}`}{' '}
                        {md.feature}
                        <br />
                        {this.showMotifLogo() && (
                            <MotifLogo
                                motifName={activeFeature.metadata.motifName}
                            />
                        )}
                        {this.showClusterControls() && (
                            <ClusterControls
                                featureIndex={activeFeatureIndex}
                                feature={activeFeature}
                            />
                        )}
                        {this.showCommunityAnnotationTable() && (
                            <CommunityAnnotationTable
                                communityAnnotations={md.cellTypeAnno}
                                activeFeature={activeFeature}
                            />
                        )}
                        {this.showFeatureMarkerTable() && (
                            <FeatureMarkerTable
                                history={history}
                                activePage={activePage}
                                metadata={md}
                                activeFeature={activeFeature}
                                activeFeatureIndex={activeFeatureIndex}
                            />
                        )}
                        {this.showLegendTable() && (
                            <LegendTable
                                activeLegend={this.props.activeLegend}
                            />
                        )}
                        {this.showDownloadLoomButton() && (
                            <DownloadLoomButton activeFeature={activeFeature} />
                        )}
                        {this.showGProfilerModal() && md.genes && (
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
                key={activeFeature.feature}
                className={
                    'feature' + activeFeatureIndex + ' stretched marginBottom'
                }
                style={{ textAlign: 'center' }}>
                <Grid>
                    <Grid.Row columns='1' centered className='viewerRow'>
                        <Grid.Column className='viewerCell'>
                            {activeFeature ? activeFeature.featureType : ''}{' '}
                            <b>
                                {' '}
                                {activeFeature
                                    ? activeFeature.feature
                                    : ''}{' '}
                            </b>
                        </Grid.Column>
                    </Grid.Row>
                    {metadata}
                </Grid>
            </Tab.Pane>
        );
    }
}

export default QueryFeatureTab;
