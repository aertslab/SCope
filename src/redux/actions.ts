import * as Action from './actionTypes';
import { MainState } from './types';

export const setAppLoading = (isAppLoading: MainState['isAppLoading']) => ({
    type: Action.SET_APP_LOADING,
    payload: isAppLoading,
});

export const setUUID = (uuid: MainState['uuid']) => ({
    type: Action.SET_UUID,
    payload: uuid,
});

export const setSessionMode = (sessionMode: MainState['sessionMode']) => ({
    type: Action.SET_SESSION_MODE,
    payload: sessionMode,
});

export const toggleSidebar = () => ({
    type: Action.TOGGLE_SIDEBAR_VISIBLE,
});
