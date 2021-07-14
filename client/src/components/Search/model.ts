import * as R from 'ramda';
import { StrictSearchCategoryProps, SearchResult } from 'semantic-ui-react';

import { Features } from '../../api';

export type FeatureSearchSelection = {
    readonly title: string;
    readonly category: string;
    readonly description: string;
    readonly colour: string;
};

const makeSelection = (
    colour: string,
    category: string
): ((_partial: {
    title: string;
    description: string;
}) => FeatureSearchSelection) =>
    R.compose(
        R.assoc('colour', colour),
        R.assoc('category', category)
    ) as (_partial: {
        title: string;
        description: string;
    }) => FeatureSearchSelection;

export const findResult = (
    query: { title: string; category: string },
    colour: string,
    results: readonly Features[]
): FeatureSearchSelection | undefined => {
    const searchSpace: FeatureSearchSelection[] = R.chain(
        (r) => R.map(makeSelection(colour, r.category), r.results),
        results
    );

    if (query.category.startsWith('Clustering:')) {
        return R.head(
            R.filter(
                R.propEq<keyof FeatureSearchSelection>(
                    'category',
                    query.category
                ),
                searchSpace
            )
        );
    }
    return R.head(
        R.filter(
            R.propEq<keyof FeatureSearchSelection>('title', query.title),
            searchSpace
        )
    );
};

export type FeatureSearch = {
    field: string;
    loading: boolean;
    value: string;
    results: Array<Features>;
    selected?: FeatureSearchSelection;
    error?: string;
};

export type State = { [field: string]: FeatureSearch };

export const init = (field: string): FeatureSearch => {
    return {
        field,
        loading: false,
        value: '',
        results: [],
        selected: undefined,
        error: undefined,
    };
};

export const featuresToResults = (
    features: Features
): [string, StrictSearchCategoryProps] => {
    return [
        features.category,
        {
            name: features.category,
            results: features.results.map((result) => {
                return {
                    ...result,
                    category: features.category,
                    id: window.btoa(result.title + result.description),
                };
            }) as unknown as typeof SearchResult[],
        },
    ];
};

export const orderCategories = (a: Features, b: Features): boolean => {
    const order = ['gene', 'regulon', 'clustering', 'annotation', 'metric'];

    const category = (feature: Features): string =>
        feature.category.startsWith('Clustering')
            ? 'clustering'
            : feature.category;

    return order.indexOf(category(a)) < order.indexOf(category(b));
};
