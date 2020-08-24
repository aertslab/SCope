import { StrictSearchCategoryProps } from 'semantic-ui-react';
import { has } from 'ramda';

import { RootState } from '../../redux/reducers';
import { Features } from '../../api';

import { NAME } from './constants';

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
        return state[NAME][field].selected !== null;
    }

    return false;
};
