import { Project, DataSet } from '../api';

import * as AT from './actionTypes';

export const SESSION_READ = 'r';
export const SESSION_READWRITE = 'rw';

export type SessionMode = 'r' | 'rw';

export interface MainState {
    isAppLoading: boolean;
    uuid: string;
    sessionMode: SessionMode;
    projects: Array<Project>;
    datasets: Array<DataSet>;
}

export interface SetLoadingAction {
    type: typeof AT.SET_APP_LOADING;
    payload: boolean;
}

export interface SetUUIDAction {
    type: typeof AT.SET_UUID;
    payload: string;
}

export interface SetSessionModeAction {
    type: typeof AT.SET_SESSION_MODE;
    payload: SessionMode;
}

export interface MyProjects {
    type: typeof AT.MY_PROJECTS;
    payload: {
        projects: Array<Project>;
        datasets: Array<DataSet>;
    };
}

export interface ErrorAction {
    type: typeof AT.ERROR;
    payload: string;
}

export type MainAction =
    | SetLoadingAction
    | SetUUIDAction
    | SetSessionModeAction
    | MyProjects
    | ErrorAction;
