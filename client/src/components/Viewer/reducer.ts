import produce from 'immer';
import { Reducer } from 'redux';

import { State, initState } from './model';
import { ViewerAction } from './actions';
import * as AT from './actionTypes';

const initialState: State = initState();

export const reducer: Reducer<State, ViewerAction> = produce(
    (draft: State, action: ViewerAction) => {
        switch (action.type) {
            case AT.SELECT_DATASET:
                draft.project = action.payload.project;
                draft.dataset = action.payload.dataset;
                break;
        }
    },
    initialState
);
