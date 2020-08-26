import {
    SET_APP_LOADING,
    SET_UUID,
    SET_SESSION_MODE,
    TOGGLE_SIDEBAR_VISIBLE,
} from './actionTypes';

export const SESSION_READ = 'r';
export const SESSION_READWRITE = 'rw';

export type SessionMode = 'r' | 'rw';

export interface MainState {
    isAppLoading: boolean;
    uuid: string;
    sessionMode: SessionMode;
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
    payload: SessionMode;
}

export interface ToggleSidebar {
    type: typeof TOGGLE_SIDEBAR_VISIBLE;
}

export type MainAction =
    | SetLoadingAction
    | SetUUIDAction
    | SetSessionModeAction
    | ToggleSidebar;
