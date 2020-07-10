import { SET_APP_LOADING } from '../actionTypes';
import { AppLoading, SetLoadingAction } from '../types';

type MainState = {} & AppLoading;

const initialState: MainState = {
    isAppLoading: true,
};

const main = (state = initialState, action: SetLoadingAction) => {
    const { type, payload } = action;
    switch (type) {
        case SET_APP_LOADING: {
            return {
                ...state,
                isLoading: payload.isAppLoading,
            };
        }
        default: {
            return state;
        }
    }
};

export default main;
