import { RootState } from '../../redux/reducers';

//import { ViewerId, ViewerMap } from './model';
import { Container, Layout, leaves } from './model';
import { NAME } from './constants';

// export const viewers = (state: RootState): ViewerMap => state[NAME].viewers;

// export const grid = (state: RootState): Array<Array<ViewerId | undefined>> =>
//     state[NAME].grid.grid;

// export const shape = (state: RootState): [number, number] => [
//     state[NAME].grid.rows,
//     state[NAME].grid.cols,
// ];

export const shape = (state: RootState): [number, number] => {
    const ls = leaves(state[NAME]);
    return [
        Math.max(...ls.map((c: Container): number => c.width)),
        Math.max(...ls.map((c: Container): number => c.height)),
    ];
};

export const viewNodes = (state: RootState): Array<Container> =>
    leaves(state[NAME]);

export const layout = (state: RootState): Layout => state[NAME];
