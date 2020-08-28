import * as R from 'ramda';
import { StrictSearchCategoryProps, SearchResult } from 'semantic-ui-react';

import { Features } from '../../api';

export type FeatureFilter =
    | 'all'
    | 'gene'
    | 'regulon'
    | 'annotation'
    | 'metric'
    | 'cluster';

export interface FeatureSearchSelection {
    readonly title: string;
    readonly category: FeatureFilter;
    readonly description: string;
    readonly colour: string;
}

const makeSelection = R.curry(
    (
        colour: string,
        category: string
    ): ((partial: {
        title: string;
        description: string;
    }) => FeatureSearchSelection) =>
        R.compose(
            R.assoc('colour', colour),
            R.assoc('category', toFeatureFilter(category))
        ) as (partial: {
            title: string;
            description: string;
        }) => FeatureSearchSelection
);

export const findResult = (
    query: { title: string },
    colour: string,
    results: Array<Features>
): FeatureSearchSelection | undefined => {
    const searchSpace: FeatureSearchSelection[] = R.chain(
        (r) => R.map(makeSelection(colour, r.category), r.results),
        results
    );

    return R.filter(
        R.propEq<keyof FeatureSearchSelection, any>('title', query.title),
        searchSpace
    )[0];
};

export type FeatureSearch = {
    field: string;
    filter: FeatureFilter;
    loading: boolean;
    value: string;
    results: Array<Features>;
    selected?: FeatureSearchSelection;
};

export type State = { [field: string]: FeatureSearch };

export const toFeatureFilter = (val: string): FeatureFilter | undefined => {
    switch (val) {
        case 'all':
        case 'gene':
        case 'regulon':
        case 'annotation':
        case 'metric':
        case 'cluster':
            return val as FeatureFilter;
        default:
            return undefined;
    }
};

export const init = (field: string): FeatureSearch => {
    return {
        field,
        filter: 'all',
        loading: false,
        value: '',
        results: [],
        selected: undefined,
    };
};

export const featuresToResults = (
    features: Features
): [string, StrictSearchCategoryProps] => {
    return [
        features.category,
        {
            name: features.category,
            results: (features.results.map((result) => {
                return { ...result, id: window.btoa(result.title) };
            }) as unknown) as typeof SearchResult[],
        },
    ];
};
