import { has } from 'ramda';

import { RootState } from '../../redux/reducers';
import { Features } from '../../api';

import { NAME } from './constants';
import { FeatureSearchSelection } from './model';

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

export const selected = (
    field: string,
    state: RootState
): FeatureSearchSelection | undefined => {
    if (has(field, state[NAME])) {
        return state[NAME][field].selected;
    }

    return undefined;
};

export const value = (field: string, state: RootState): string => {
    if (has(field, state[NAME])) {
        return state[NAME][field].value;
    }

    return '';
};
