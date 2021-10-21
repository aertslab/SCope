import * as AT from './actionTypes';
import { MainState } from './types';

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
) => ({
    type: AT.MY_PROJECTS,
    payload: { projects, datasets },
});
