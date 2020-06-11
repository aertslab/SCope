import { SET_LOADING } from '../actionTypes';
import { SetLoadingAction } from '../types';

type Loading = {
    isLoading: boolean;
};

type MainState = {} & Loading;

const initialState: MainState = {
    isLoading: true,
};

const main = (state = initialState, action: SetLoadingAction) => {
    switch (action.type) {
        case SET_LOADING: {
            return {
                ...state,
                isLoading: action.payload.isLoading,
            };
        }
        default: {
            return state;
        }
    }
};

export default main;
