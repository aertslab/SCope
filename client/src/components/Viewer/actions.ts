import * as Action from './actionTypes';

export interface SelectDataset {
    type: typeof Action.SELECT_DATASET;
    payload: {
        project: string;
        dataset: number;
    };
}

export const selectDataset = (
    project: string,
    dataset: number
): SelectDataset => ({
    type: Action.SELECT_DATASET,
    payload: { project, dataset },
});

export type ViewerAction = SelectDataset;
