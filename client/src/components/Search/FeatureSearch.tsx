import React from 'react';

import { FEATURE_COLOURS } from '../constants';

import { FeatureCategory } from '../../model';
import { FeatureSearchBox } from './FeatureSearchBox';

interface FeatureSearchProps {
    /** A unique identifier for these search boxes. */
    identifier: string;

    /** Use this to initialise the feature types dropdown. */
    filter: FeatureCategory;

    /** Determine the background colour */
    colour?: (_which: number) => string;
}

/**
 * A series of 3 text search input for properties on a dataset
 */
export function FeatureSearchGroup(props: FeatureSearchProps) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gridColumn: '1 / 3',
                gap: '10px',
                padding: '10px 0px 0px 0px',
            }}>
            {[0, 1, 2].map((i) => (
                <FeatureSearchBox
                    key={`${props.identifier}-${i}`}
                    field={`${props.identifier}-${i}`}
                    filter={props.filter}
                    colour={props.colour ? props.colour(i) : FEATURE_COLOURS[i]}
                />
            ))}
        </div>
    );
}
