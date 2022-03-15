import { Project, DataSet, Coordinate } from '../api';

import * as AT from './actionTypes';

export const SESSION_READ = 'r';
export const SESSION_READWRITE = 'rw';

export type SessionMode = 'r' | 'rw';

export type UploadState = 'none' | 'in progress' | 'finished';

export type ModifierKey = 'None' | 'Shift' | 'Control' | 'Alt';

export interface MainState {
    isAppLoading: boolean;
    uuid: string;
    sessionMode: SessionMode;
    projects: Array<Project>;
    datasets: Array<DataSet>;
    coords: Array<Coordinate>;
    upload: {
        state: UploadState;
        progress: number;
        file?: File;
    };
    modifierKey: ModifierKey;
    error: string;
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

export interface NewProjectAction {
    type: typeof AT.NEW_PROJECT;
    payload: {
        name: string;
    };
}

export interface AddProjectAction {
    type: typeof AT.ADD_PROJECT;
    payload: {
        project: Project;
    };
}

export interface AddDataSetAction {
    type: typeof AT.ADD_DATASET;
    payload: {
        dataset: DataSet;
    };
}

export interface ErrorAction {
    type: typeof AT.ERROR;
    payload: string;
}

export interface UploadRequest {
    type: typeof AT.UPLOAD_REQUEST;
    payload: {
        name: string;
        project: string;
        file: File;
    };
}

export interface UploadProgress {
    type: typeof AT.UPLOAD_PROGRESS;
    payload: {
        progress: number;
        file: File;
    };
}

export interface UploadSuccess {
    type: typeof AT.UPLOAD_SUCCESS;
    payload: {
        file: File;
    };
}

export interface ToggleModifierKey {
    type: typeof AT.MODIFIER_KEY_TOGGLE;
    payload: {
        key: ModifierKey;
    };
}

export interface GetCoordinates {
    type: typeof AT.GET_COORDINATES;
    payload: {
        dataset: string;
    };
}

export interface ReceivedCoordinates {
    type: typeof AT.RECEIVED_COORDINATES;
    payload: {
        coordinates: Array<Coordinate>;
    };
}

export type MainAction =
    | SetLoadingAction
    | SetUUIDAction
    | SetSessionModeAction
    | MyProjects
    | NewProjectAction
    | AddProjectAction
    | AddDataSetAction
    | ErrorAction
    | UploadRequest
    | UploadProgress
    | UploadSuccess
    | ToggleModifierKey
    | GetCoordinates
    | ReceivedCoordinates;
