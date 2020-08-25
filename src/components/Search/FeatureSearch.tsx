import React from 'react';
import { Grid, SemanticCOLORS } from 'semantic-ui-react';

import { FeatureFilter } from './model';
import { FEATURE_COLOURS } from './constants';

import FeatureSearchBox from './FeatureSearchBox';

interface FeatureSearchProps {
    /** A unique identifier for these search boxes. */
    identifier: string;

    /** Use this to initialise the feature types dropdown. */
    filter: FeatureFilter;

    /** Use this to restrict selectable feature types (to only `feature`). */
    singleFeature: boolean;

    /** Determine the background colour */
    colour?: (which: number) => string;
}

/**
 * A series of 3 text search input for properties on a dataset
 */
export function FeatureSearchGroup(props: FeatureSearchProps) {
    return (
        <React.Fragment>
            <Grid.Row columns='3' centered>
                {[0, 1, 2].map((i) => (
                    <Grid.Column key={i}>
                        <FeatureSearchBox
                            field={`${props.identifier}-${i}`}
                            filter={props.filter}
                            colour={
                                props.colour
                                    ? props.colour(i)
                                    : FEATURE_COLOURS[i]
                            }
                        />
                    </Grid.Column>
                ))}
            </Grid.Row>
        </React.Fragment>
    );
}
