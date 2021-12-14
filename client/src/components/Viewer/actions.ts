import * as Action from './actionTypes';

export type AddViewer = {
    type: typeof Action.ADD_VIEWER_ROW | typeof Action.ADD_VIEWER_COL;
};

export const addViewerRow = (): AddViewer => ({
    type: Action.ADD_VIEWER_ROW,
});

export const addViewerCol = (): AddViewer => ({
    type: Action.ADD_VIEWER_COL,
});

export type RemoveViewer = {
    type: typeof Action.REMOVE_VIEWER_ROW | typeof Action.REMOVE_VIEWER_COL;
    payload: number;
};

export const removeViewerRow = (row: number): RemoveViewer => ({
    type: Action.REMOVE_VIEWER_ROW,
    payload: row,
});

export const removeViewerCol = (col: number): RemoveViewer => ({
    type: Action.REMOVE_VIEWER_COL,
    payload: col,
});

export type AppendViewer = {
    type: typeof Action.APPEND_VIEWER;
    payload: {
        project: string;
        dataset: number;
    };
};

export const appendViewer = (
    project: string,
    dataset: number
): AppendViewer => ({
    type: Action.APPEND_VIEWER,
    payload: { project, dataset },
});

export type InsertViewer = {
    type: typeof Action.INSERT_VIEWER;
    payload: {
        project: string;
        dataset: number;
        row: number;
        col: number;
    };
};

export const insertViewer = (
    project: string,
    dataset: number,
    row: number,
    col: number
): InsertViewer => ({
    type: Action.INSERT_VIEWER,
    payload: { project, dataset, row, col },
});

export type ViewerAction =
    | AddViewer
    | RemoveViewer
    | AppendViewer
    | InsertViewer;
