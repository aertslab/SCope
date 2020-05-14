import { SET_LOADING } from './actionTypes';

export interface Loading {
    isLoading: boolean;
}

export interface SetLoadingAction {
    type: typeof SET_LOADING;
    payload: Loading;
}
