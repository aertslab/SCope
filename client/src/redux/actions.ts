import { Project, DataSet, Coordinate } from '../api';

import * as AT from './actionTypes';
import {
    MainState,
    MyProjects,
    ErrorAction,
    NewProjectAction,
    AddProjectAction,
    AddDataSetAction,
    ModifierKey,
    ToggleModifierKey,
    GetCoordinates,
    ReceivedCoordinates,
} from './types';

export const setAppLoading = (isAppLoading: MainState['isAppLoading']) => ({
    type: AT.SET_APP_LOADING,
    payload: isAppLoading,
});

export const setUUID = (uuid: MainState['uuid']) => ({
    type: AT.SET_UUID,
    payload: uuid,
});

export const setSessionMode = (sessionMode: MainState['sessionMode']) => ({
    type: AT.SET_SESSION_MODE,
    payload: sessionMode,
});

export const myProjects = (
    projects: MainState['projects'],
    datasets: MainState['datasets']
): MyProjects => ({
    type: AT.MY_PROJECTS,
    payload: { projects, datasets },
});

export const newProject = (name: string): NewProjectAction => ({
    type: AT.NEW_PROJECT,
    payload: { name },
});

export const addProject = (project: Project): AddProjectAction => ({
    type: AT.ADD_PROJECT,
    payload: { project },
});

export const addDataset = (dataset: DataSet): AddDataSetAction => ({
    type: AT.ADD_DATASET,
    payload: { dataset },
});

export const error = (message: string): ErrorAction => ({
    type: AT.ERROR,
    payload: message,
});

export const uploadRequest = (file: File, name: string, project: string) => ({
    type: AT.UPLOAD_REQUEST,
    payload: { name, project, file },
});

export const uploadProgress = (file: File, progress: number) => ({
    type: AT.UPLOAD_PROGRESS,
    payload: { progress, file },
});

export const uploadSuccess = (file: File) => ({
    type: AT.UPLOAD_SUCCESS,
    payload: { file },
});

export const toggleModifierKey = (key: ModifierKey): ToggleModifierKey => ({
    type: AT.MODIFIER_KEY_TOGGLE,
    payload: { key },
});

export const getCoordinates = (dataset: string): GetCoordinates => ({
    type: AT.GET_COORDINATES,
    payload: { dataset },
});

export const receivedCoordinates = (
    coords: Array<Coordinate>
): ReceivedCoordinates => ({
    type: AT.RECEIVED_COORDINATES,
    payload: { coordinates: coords },
});
