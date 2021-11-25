import { RootState } from '../../redux/reducers';

import { ViewerId, ViewerMap } from './model';
import { NAME } from './constants';

export const viewers = (state: RootState): ViewerMap => state[NAME].viewers;

export const grid = (state: RootState): Array<Array<ViewerId | undefined>> =>
    state[NAME].grid.grid;

export const shape = (state: RootState): [number, number] => [
    state[NAME].grid.rows,
    state[NAME].grid.cols,
];
