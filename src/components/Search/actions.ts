import * as Action from './actionTypes';

import { FeatureQuery, Features } from '../../api';
import { FeatureFilter, FeatureSearchSelection } from './model';

export interface SearchQuery {
    type: typeof Action.QUERY;
    payload: {
        query: FeatureQuery;
        field: string;
    };
}

export const search = (
    field: string,
    dataset: string,
    category: FeatureFilter,
    query: string
): SearchQuery => {
    return {
        type: Action.QUERY,
        payload: {
            query: { dataset, category, query },
            field,
        },
    };
};

export interface SearchResults {
    type: typeof Action.RESULTS;
    payload: {
        results: Array<Features>;
        field: string;
    };
}

export const results = (
    field: string,
    results: Array<Features>
): SearchResults => {
    return {
        type: Action.RESULTS,
        payload: { results, field },
    };
};

export interface SearchFilter {
    type: typeof Action.FILTER;
    payload: {
        filter: FeatureFilter;
        field: string;
    };
}

export const filter = (field: string, filter: FeatureFilter): SearchFilter => {
    return {
        type: Action.FILTER,
        payload: { filter, field },
    };
};

export interface SearchResultSelect {
    type: typeof Action.SELECT;
    payload: {
        selection: FeatureSearchSelection;
        field: string;
    };
}

export const select = (
    field: string,
    selection: FeatureSearchSelection
): SearchResultSelect => {
    return {
        type: Action.SELECT,
        payload: { selection, field },
    };
};

export interface SearchError {
    type: typeof Action.ERROR;
    payload: {
        message: string;
        field: string;
    };
}

export const error = (field: string, message: string): SearchError => {
    return {
        type: Action.ERROR,
        payload: { message, field },
    };
};

export type SearchAction =
    | SearchResults
    | SearchQuery
    | SearchFilter
    | SearchResultSelect
    | SearchError;
