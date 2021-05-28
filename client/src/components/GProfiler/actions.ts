import * as Action from './actionTypes';
import { GProfilerOrganism } from './model';

export interface ToggleModal {
    type: typeof Action.TOGGLE_MODAL;
}

export const toggleModal = (): ToggleModal => {
    return {
        type: Action.TOGGLE_MODAL,
    };
};

export interface SelectOrganism {
    type: typeof Action.SELECT_ORGANISM;
    payload: {
        organism: string;
    };
}

export const selectOrganism = (organism: string): SelectOrganism => {
    return {
        type: Action.SELECT_ORGANISM,
        payload: {
            organism,
        },
    };
};

export interface SelectSortBy {
    type: typeof Action.SELECT_SORT_BY;
    payload: {
        sortBy: string;
    };
}

export const selectSortBy = (sortBy: string): SelectSortBy => {
    return {
        type: Action.SELECT_SORT_BY,
        payload: {
            sortBy,
        },
    };
};

export interface SetTopGeneListSizes {
    type: typeof Action.SET_TOP_GENE_LIST_SIZES;
    payload: {
        topGeneListSizes: number[];
    };
}

export const setTopGeneListSizes = (
    topGeneListSizes: number[]
): SetTopGeneListSizes => {
    return {
        type: Action.SET_TOP_GENE_LIST_SIZES,
        payload: {
            topGeneListSizes,
        },
    };
};

export interface FetchAvailableOrganisms {
    type: typeof Action.FETCH_AVAILABLE_ORGANISMS;
}

export const fetchAvailableOrganisms = (): FetchAvailableOrganisms => {
    return {
        type: Action.FETCH_AVAILABLE_ORGANISMS,
    };
};

export interface SetAvailableOrganisms {
    type: typeof Action.SET_AVAILABLE_ORGANISMS;
    payload: {
        availableOrganisms: GProfilerOrganism[];
    };
}

export const setAvailableOrganisms = (
    availableOrganisms: GProfilerOrganism[]
): SetAvailableOrganisms => {
    return {
        type: Action.SET_AVAILABLE_ORGANISMS,
        payload: {
            availableOrganisms,
        },
    };
};

export interface SetGProfilerToken {
    type: typeof Action.SET_GPROFILER_TOKEN;
    payload: {
        gProfilerToken: string;
    };
}

export const setGProfilerToken = (
    gProfilerToken: string
): SetGProfilerToken => {
    return {
        type: Action.SET_GPROFILER_TOKEN,
        payload: {
            gProfilerToken,
        },
    };
};

export interface SetGProfilerLink {
    type: typeof Action.SET_GPROFILER_LINK;
    payload: {
        gProfilerLink: string;
    };
}

export const setGProfilerLink = (gProfilerLink: string): SetGProfilerLink => {
    return {
        type: Action.SET_GPROFILER_LINK,
        payload: {
            gProfilerLink,
        },
    };
};

export interface SetError {
    type: typeof Action.SET_ERROR;
    payload: {
        error: string;
    };
}

export const setError = (error: string): SetError => {
    return {
        type: Action.SET_ERROR,
        payload: {
            error,
        },
    };
};

export type GProfilerAction =
    | ToggleModal
    | SelectOrganism
    | SelectSortBy
    | SetTopGeneListSizes
    | FetchAvailableOrganisms
    | SetAvailableOrganisms
    | SetGProfilerToken
    | SetGProfilerLink
    | SetError;
