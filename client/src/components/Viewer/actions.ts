import * as Action from './actionTypes';

export type SplitViewer = {
    type: typeof Action.SPLIT_VERTICAL | typeof Action.SPLIT_HORIZONTAL;
    payload: number;
};

export const splitVertical = (which: number): SplitViewer => ({
    type: Action.SPLIT_VERTICAL,
    payload: which,
});

export const splotHorizontal = (which: number): SplitViewer => ({
    type: Action.SPLIT_HORIZONTAL,
    payload: which,
});

export type DeleteViewer = {
    type: typeof Action.DELETE;
    payload: number;
};

export const deleteViewer = (which: number): DeleteViewer => ({
    type: Action.DELETE,
    payload: which,
});

export type ChangeLayout = {
    type: typeof Action.LAYOUT;
    payload: {
        width: number;
        height: number;
    };
};

export const layout = ({ width, height }): ChangeLayout => ({
    type: Action.LAYOUT,
    payload: { width, height },
});

export type ViewerAction = SplitViewer | DeleteViewer | ChangeLayout;
