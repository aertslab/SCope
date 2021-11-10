import * as AT from './actionTypes';
import { MainState, MyProjects, ErrorAction } from './types';

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

export const error = (message: string): ErrorAction => ({
    type: AT.ERROR,
    payload: message,
});
