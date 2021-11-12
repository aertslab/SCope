import { Project } from '../api';

import * as AT from './actionTypes';
import {
    MainState,
    MyProjects,
    ErrorAction,
    NewProjectAction,
    AddProjectAction,
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

export const error = (message: string): ErrorAction => ({
    type: AT.ERROR,
    payload: message,
});
