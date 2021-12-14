import * as R from 'ramda';

export type ViewerInfo = {
    project: string;
    dataset: number;
};

export type ViewerId = number;

export type ViewerMap = {
    [index: ViewerId]: ViewerInfo;
};

// Row major order: index for rows first
export type ViewerGrid = {
    grid: Array<Array<ViewerId | undefined>>;
    rows: number;
    cols: number;
};

export interface State {
    lastId: ViewerId;
    viewers: ViewerMap;
    grid: ViewerGrid;
}

export const initState = (): State => {
    return {
        lastId: 0,
        viewers: {},
        grid: initGrid(1, 1),
    };
};

// NOTE: Behaviour is UNDEFINED when cols or rows === 0
// DO NOT initialise with cols or rows === 0
export const initGrid = (rows: number, cols: number): ViewerGrid => {
    return {
        grid: R.repeat(R.repeat(undefined, cols), rows),
        rows,
        cols,
    };
};

export const appendCol = (grid: ViewerGrid): ViewerGrid => {
    return {
        ...grid,
        cols: grid.cols + 1,
        grid: R.map(R.append(undefined), grid.grid),
    };
};

export const appendRow = (grid: ViewerGrid): ViewerGrid => {
    return {
        ...grid,
        rows: grid.rows + 1,
        grid: R.append(R.repeat(undefined, grid.cols), grid.grid),
    };
};

export const placeViewer = (grid: ViewerGrid, viewer: ViewerId): ViewerGrid => {
    if (R.includes(undefined, R.flatten(grid.grid))) {
        return placeInGrid(grid, viewer);
    } else if (grid.rows >= grid.cols) {
        return placeInGrid(appendCol(grid), viewer);
    } else {
        return placeInGrid(appendRow(grid), viewer);
    }
};

//! Find the first [row, col] index that is `undefined` (does not contain a viewer)
const placeInGrid = (grid: ViewerGrid, viewer: ViewerId): ViewerGrid => {
    const [row, col] = R.head(
        R.filter(
            ([_row, col]) => col !== -1,
            grid.grid.map((v, i): [number, number] => [
                i,
                R.indexOf(undefined, v),
            ])
        )
    ) as [number, number];

    const newGrid = { ...grid };
    newGrid.grid[row][col] = viewer;
    return newGrid;
};

export const removeRow = (grid: ViewerGrid, row: number): ViewerGrid => {
    if (grid.rows > 1) {
        return {
            grid: R.addIndex(R.filter)((_, i) => i !== row, grid.grid),
            rows: grid.rows - 1,
            cols: grid.cols,
        };
    } else {
        return grid;
    }
};

export const removeCol = (grid: ViewerGrid, col: number): ViewerGrid => {
    const indexedFilter = R.addIndex(R.filter);
    if (grid.cols > 1) {
        return {
            grid: R.map(
                (row) => indexedFilter((_, i) => i !== col, row),
                grid.grid
            ),
            rows: grid.rows,
            cols: grid.cols - 1,
        };
    } else {
        return grid;
    }
};
