import React from 'react';
import { Grid } from 'semantic-ui-react';

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
        <Grid>
            <Grid.Row columns='3' centered className='feature-search-bar'>
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
        </Grid>
    );
}
