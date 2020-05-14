import { SET_LOADING } from './actionTypes';

export const setLoading = (isLoading: boolean) => ({
    type: SET_LOADING,
    payload: {
        isLoading: isLoading
    }
});
