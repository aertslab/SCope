import React from 'react';

import { getChannelFromFeatureIndex } from './model';

type EmptyFeatureDisplayMessageProps = {
    featureIndex: number;
};

export class EmptyFeatureDisplayMessage extends React.Component<
    EmptyFeatureDisplayMessageProps
> {
    constructor(props: EmptyFeatureDisplayMessageProps) {
        super(props);
    }

    render() {
        const { featureIndex } = this.props;

        const channel = getChannelFromFeatureIndex(featureIndex);

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
    }
}
