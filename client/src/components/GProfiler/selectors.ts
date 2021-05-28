import { RootState } from '../../redux/reducers';

import { NAME } from './constants';
import { GProfilerOrganism } from './model';

export const isDisplayed = (state: RootState): boolean => {
    return state[NAME].display;
};

export const getSelectedOrganism = (state: RootState): string => {
    return state[NAME].selectedOrganism;
};

export const getSelectedSortBy = (state: RootState): string => {
    return state[NAME].selectedSortBy;
};

export const getGProfilerToken = (state: RootState): string => {
    return state[NAME].gProfilerToken;
};

export const getAvailableOrganisms = (
    state: RootState
): GProfilerOrganism[] => {
    return state[NAME].availableOrganisms;
};

export const isFetchingAvailableOrganisms = (state: RootState): boolean => {
    return state[NAME].isFetchingAvailableOrganisms;
};

export const getSelectedTopGeneListsSizes = (state: RootState): number[] => {
    return state[NAME].selectedTopGeneListsSizes;
};

export const getError = (state: RootState): string => {
    return state[NAME].error;
};
