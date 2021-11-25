import produce from 'immer';
import { Reducer } from 'redux';

import { State, initState } from './model';
import * as Model from './model';
import { ViewerAction, AppendViewer, InsertViewer } from './actions';
import * as AT from './actionTypes';

const initialState: State = initState();

export const reducer: Reducer<State, ViewerAction> = produce(
    (draft: State, action: ViewerAction) => {
        switch (action.type) {
            case AT.ADD_VIEWER_COL:
                draft.grid = Model.appendCol(draft.grid);
                break;

            case AT.ADD_VIEWER_ROW:
                draft.grid = Model.appendRow(draft.grid);
                break;

            case AT.INSERT_VIEWER:
                draft.viewers = {
                    ...draft.viewers,
                    [draft.lastId]: {
                        project: (action as InsertViewer).payload.project,
                        dataset: (action as InsertViewer).payload.dataset,
                    },
                };
                draft.grid[(action as InsertViewer).payload.col][
                    (action as InsertViewer).payload.row
                ] = draft.lastId;
                draft.lastId += 1;
                break;

            case AT.APPEND_VIEWER:
                draft.viewers = {
                    ...draft.viewers,
                    [draft.lastId]: {
                        project: (action as AppendViewer).payload.project,
                        dataset: (action as AppendViewer).payload.dataset,
                    },
                };
                draft.grid = Model.placeViewer(draft.grid, draft.lastId);
                draft.lastId += 1;
                break;
        }
    },
    initialState
);
