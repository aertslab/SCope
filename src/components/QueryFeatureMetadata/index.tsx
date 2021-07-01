import React from 'react';
import { Grid } from 'semantic-ui-react';

import GProfilerModal from '../GProfiler/GProfilerModal';
import ClusterControls from '../ClusterControls';
import { EmptyFeatureDisplayMessage } from '../QueryFeatureTool/EmptyFeatureDisplayMessage';
import { MotifLogo } from '../MotifLogo';
import CommunityAnnotationTable from '../CommunityAnnotationTable';
import FeatureMarkerTable from '../FeatureMarkerTable';
import LegendTable from '../LegendTable';
import DownloadLoomButton from '../buttons/DownloadLoomButton';

type QueryFeatureMetadataProps = {
    history: any;
    activeFeature: any;
    activeFeatureIndex: number;
    activePage: any;
    activeLegend: any;
    sessionIsRW: boolean;
};

export const QueryFeatureMetadata: React.FC<QueryFeatureMetadataProps> = (
    props
) => {
    const showMotifLogo = () => {
        return props.activeFeature.metadata?.motifName;
    };

    const showClusterControls = () => {
        return (
            props.activeFeature.featureType.startsWith('Cluster') &&
            props.activeFeature.feature !== 'All Clusters' &&
            props.sessionIsRW &&
            props.activePage === 'gene'
        );
    };

    const showCommunityAnnotationTable = () => {
        return props.activeFeature.metadata?.cellTypeAnno;
    };

    const showFeatureMarkerTable = () => {
        return props.activeFeature.metadata?.genes;
    };

    const showLegendTable = () => {
        return (
            props.activeLegend !== null &&
            (props.activeFeature.featureType === 'annotation' ||
                props.activeFeature.feature === 'All Clusters')
        );
    };

    const showDownloadLoomButton = () => {
        return props.activeFeature.featureType.startsWith('Clustering');
    };

    const showGProfilerModal = () => {
        return props.activeFeature.featureType.startsWith('Clustering');
    };

    if (props.activeFeature?.metadata) {
        const md = props.activeFeature.metadata;

        return (
            <Grid.Row columns='1' centered className='viewerRow'>
                <Grid.Column stretched className='viewerCell'>
                    {md.featureType}{' '}
                    {props.activeFeature.featureType.startsWith('Clustering') &&
                        `Group: ${md.clusteringGroup}`}{' '}
                    {md.feature}
                    <br />
                    {showMotifLogo() && (
                        <MotifLogo
                            motifName={props.activeFeature.metadata.motifName}
                        />
                    )}
                    {showClusterControls() && (
                        <ClusterControls
                            featureIndex={props.activeFeatureIndex}
                            feature={props.activeFeature}
                        />
                    )}
                    {showCommunityAnnotationTable() && (
                        <CommunityAnnotationTable
                            communityAnnotations={md.cellTypeAnno}
                            activeFeature={props.activeFeature}
                            sessionIsRW={props.sessionIsRW}
                        />
                    )}
                    {showFeatureMarkerTable() && (
                        <FeatureMarkerTable
                            history={history}
                            activePage={props.activePage}
                            metadata={md}
                            activeFeature={props.activeFeature}
                            activeFeatureIndex={props.activeFeatureIndex}
                        />
                    )}
                    {showLegendTable() && (
                        <LegendTable activeLegend={props.activeLegend} />
                    )}
                    {showDownloadLoomButton() && (
                        <DownloadLoomButton
                            activeFeature={props.activeFeature}
                        />
                    )}
                    {showGProfilerModal() && md.genes && (
                        <GProfilerModal featureMetadata={md} />
                    )}
                    <br />
                </Grid.Column>
            </Grid.Row>
        );
    } else {
        return (
            <EmptyFeatureDisplayMessage
                featureIndex={props.activeFeatureIndex}
            />
        );
    }
};
