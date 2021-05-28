import React from 'react';

import { getChannelFromFeatureIndex } from './model';

type EmptyFeatureDisplayMessageProps = {
    featureIndex: number;
};

export const EmptyFeatureDisplayMessage: React.FC<EmptyFeatureDisplayMessageProps> =
    (props) => {
        const channel = getChannelFromFeatureIndex(props.featureIndex);

        return (
            <div>
                No additional information shown for the feature queried in the{' '}
                <b style={{ color: channel }}>{channel}</b> query box because it
                is empty. Additional information (e.g.: cluster markers, regulon
                motif, regulon target genes, ...) can be displayed here when
                querying clusters or regulons.
                <br />
                <br />
            </div>
        );
    };
