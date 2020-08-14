import {
    SET_APP_LOADING,
    SET_UUID,
    SET_SESSION_MODE,
    TOGGLE_SIDEBAR_VISIBLE,
} from './actionTypes';

export interface MainState {
    isAppLoading: boolean;
    uuid: string;
    sessionMode: 'rw' | 'r';
    sidebarIsVisible: boolean;
}

export interface SetLoadingAction {
    type: typeof SET_APP_LOADING;
    payload: boolean;
}

export interface SetUUIDAction {
    type: typeof SET_UUID;
    payload: string;
}

export interface SetSessionModeAction {
    type: typeof SET_SESSION_MODE;
    payload: 'rw' | 'r';
}

export interface ToggleSidebar {
    type: typeof TOGGLE_SIDEBAR_VISIBLE;
}

export type MainAction =
    | SetLoadingAction
    | SetUUIDAction
    | SetSessionModeAction
    | ToggleSidebar;
