import { StrictSearchCategoryProps } from 'semantic-ui-react';
import { has } from 'ramda';

import { RootState } from '../../redux/reducers';
import { Features } from '../../api';

import { NAME } from './constants';
import { FeatureFilter } from './model';

export const searchResults = (
    field: string,
    state: RootState
): readonly Features[] => {
    if (has(field, state[NAME])) {
        return state[NAME][field].results;
    }

    return [];
};

export const isLoading = (field: string, state: RootState): boolean => {
    if (has(field, state[NAME])) {
        return state[NAME][field].loading;
    }

    return false;
};

export const isSelected = (field: string, state: RootState): boolean => {
    if (has(field, state[NAME])) {
        return state[NAME][field].selected !== undefined;
    }

    return false;
};

export const hasFilter = (field: string, state: RootState): FeatureFilter => {
    if (has(field, state[NAME])) {
        return state[NAME][field].filter;
    }

    return 'all';
};
