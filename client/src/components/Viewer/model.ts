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

/// A view can be one of several "types"
type EmptyView = {
    tag: 'empty';
};

type ScatterView = {
    tag: 'scatter';
    project: string;
    dataset: number;
};

type View = EmptyView | ScatterView;

// The layout tree has leaf nodes (views) and parents for splitting (split).
type SplitContainer = {
    tag: 'split';
    parent: number | undefined;
    width: number; // fractional unit. 2 means 1/2. 3 means 1/3 and so on.
    height: number; // fractional unit.
};

type ViewContainer = {
    tag: 'leaf';
    parent: number | undefined;
    width: number; // fractional unit.
    height: number; // fractional unit.
    view: View;
};

export type Container = SplitContainer | ViewContainer;

// Single window    | Tree repr   | Storage repr
// +-----------+    |             |
// |           |    |   o         | [(w x h)]
// |           |    |             |
// |           |    |             |
// +-----------+    |             |
// -----------------+-------------+--------------
// Vertical split   |     o       |
// +-----+-----+    |    /\       | [(w x h), (w/2 x h), (w/2 x h)]
// |     |     |    |   /  \      |
// |     |     |    |  /    \     |
// |     |     |    | o      o    |
// +-----+-----+    |             |
// -----------------+-------------+--------------
// Horizontal split |      o      |
// +-----+-----+    |     / \     | [(w x h), (w/2 x h), (w/2 x h), _, _, (w/2 x h/2), (w/2 x h/2)]
// |     |     |    |    /   \    |
// |     +-----+    |   o     o   |
// |     |     |    |        / \  |
// +-----+-----+    |       o   o |
// -----------------+-------------+--------------
// Vertical split   |      o      |
// +-----+-----+    |     / \     | [(w x h), (w/2 x h), (w/2 x h), (w/2 x h/2), (w/2 x h/2), (w/2 x h/2), (w/2 x h/2)]
// |     |     |    |    /   \    |
// +-----+-----+    |   o     o   |
// |     |     |    |  / \   / \  |
// +-----+-----+    | o   o o   o |
//
export type Layout = {
    width: number; // the dimensions (in px units) of the area within which we layout views.
    height: number;
    layout: Array<Container | undefined>; // A binary tree
};

export const newLayout = (): Layout => {
    return {
        width: 0,
        height: 0,
        layout: [viewContainer(undefined, 1, 1)],
    };
};

const viewContainer = (
    parent: number | undefined,
    width: number,
    height: number
): Container => {
    return {
        tag: 'leaf',
        parent,
        width,
        height,
        view: { tag: 'empty' },
    };
};

const isLeaf = (layout: Layout, which: number): boolean => {
    return layout.layout[which]?.tag === 'leaf';
};

export const verticalSplit = (layout: Layout, which: number): Layout => {
    if (!isLeaf(layout, which)) {
        return layout;
    }

    const newLayout = {
        ...layout,
        layout: [...layout.layout],
    };
    const thisLayout = newLayout[which];

    thisLayout.tag = 'split';
    newLayout[which * 2 + 1] = viewContainer(
        which,
        thisLayout.width * 2,
        thisLayout.height
    );
    newLayout[which * 2 + 2] = viewContainer(
        which,
        thisLayout.width * 2,
        thisLayout.height
    );

    return newLayout;
};

export const horizontalSplit = (layout: Layout, which: number): Layout => {
    if (!isLeaf(layout, which)) {
        return layout;
    }

    const newLayout = {
        ...layout,
        layout: [...layout.layout],
    };
    const thisLayout = newLayout[which];

    thisLayout.tag = 'split';
    newLayout[which * 2 + 1] = viewContainer(
        which,
        thisLayout.width,
        thisLayout.height * 2
    );
    newLayout[which * 2 + 2] = viewContainer(
        which,
        thisLayout.width,
        thisLayout.height * 2
    );

    return newLayout;
};

export const deleteView = (layout: Layout, which: number): Layout => {
    if (!isLeaf(layout, which)) {
        return layout;
    }

    const newLayout = {
        ...layout,
        layout: [...layout.layout],
    };
    const parent = newLayout[which]?.parent;

    if (parent === undefined) {
        // this is the top-level, just make it a leaf
        newLayout[which].tag = 'leaf';
    } else {
        newLayout[parent].tag = 'leaf';
        newLayout[parent * 2 + 1] = undefined;
        newLayout[parent * 2 + 2] = undefined;
    }

    return newLayout;
};

export const leaves = (layout: Layout): Array<Container> => {
    return layout.layout.filter((c: Container | undefined) =>
        c === undefined ? false : c.tag === 'leaf'
    ) as Array<Container>;
};
