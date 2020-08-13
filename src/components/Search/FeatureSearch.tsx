import React from 'react';
import { Grid } from 'semantic-ui-react';

import { FeatureType } from '../../features';

import { FeatureSearchBox } from './FeatureSearchBox';

interface FeatureSearchProps {
    feature: FeatureType;
    singleFeature: boolean;
}

/**
 * A series of 3 text search input for properties on a dataset
 */
export function FeatureSearch(props: FeatureSearchProps) {
    return (
        <React.Fragment>
            <Grid.Row columns='4' centered>
                {[0, 1, 2].map((i) => (
                    <Grid.Column key={i}>
                        <FeatureSearchBox
                            field={i}
                            type={props.feature}
                            singleFeature={props.singleFeature}
                            enabled={true}
                        />
                    </Grid.Column>
                ))}
                <Grid.Column />
            </Grid.Row>
        </React.Fragment>
    );
}
