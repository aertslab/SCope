import { SET_APP_LOADING } from './actionTypes';

export const setAppLoading = (isAppLoading: boolean) => ({
    type: SET_APP_LOADING,
    payload: {
        isAppLoading,
    },
});
