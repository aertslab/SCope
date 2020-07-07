import { SET_APP_LOADING } from './actionTypes';

export interface AppLoading {
    isAppLoading: boolean;
}

export interface SetLoadingAction {
    type: typeof SET_APP_LOADING;
    payload: AppLoading;
}
