import { createSlice, CaseReducer, PayloadAction } from '@reduxjs/toolkit';

type TState = {
    isLoading: boolean;
};

type Loading = {
    isLoading: boolean;
};

const INITIAL_STATE: TState = {
    isLoading: true
};

const dummySlice = createSlice({
    name: 'dummy',
    initialState: INITIAL_STATE,
    reducers: {
        setLoading(state: TState, action: PayloadAction<Loading>) {
            state.isLoading = action.payload.isLoading;
        }
    }
});

const { actions, reducer } = dummySlice;

export const { setLoading } = actions;

export default reducer;
