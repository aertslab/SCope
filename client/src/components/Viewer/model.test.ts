import * as Model from './model';

describe('Grid manipulation', () => {
    it('Can create a 1x1 grid', () => {
        expect(Model.initGrid(1, 1)).toStrictEqual({
            grid: [[undefined]],
            rows: 1,
            cols: 1,
        });
    });

    it('Can create a grid with 2 rows and 1 column', () => {
        expect(Model.initGrid(2, 1)).toStrictEqual({
            grid: [[undefined], [undefined]],
            rows: 2,
            cols: 1,
        });
    });

    it('Can create a grid with 1 row and 2 columns', () => {
        expect(Model.initGrid(1, 2)).toStrictEqual({
            grid: [[undefined, undefined]],
            rows: 1,
            cols: 2,
        });
    });

    it('Can append a row to a grid with 1 row and 1 column', () => {
        expect(Model.appendRow(Model.initGrid(1, 1))).toStrictEqual({
            grid: [[undefined], [undefined]],
            rows: 2,
            cols: 1,
        });
    });

    it('Can append a row to a grid with 1 row and 2 columns', () => {
        expect(Model.appendRow(Model.initGrid(1, 2))).toStrictEqual({
            grid: [
                [undefined, undefined],
                [undefined, undefined],
            ],
            rows: 2,
            cols: 2,
        });
    });

    it('Can append a row to a grid with 2 rows and 1 column', () => {
        expect(Model.appendRow(Model.initGrid(2, 1))).toStrictEqual({
            grid: [[undefined], [undefined], [undefined]],
            rows: 3,
            cols: 1,
        });
    });

    it('Can append a row to a filled 2x1 grid', () => {
        const grid = {
            grid: [[0], [1]],
            rows: 2,
            cols: 1,
        };
        expect(Model.appendRow(grid)).toStrictEqual({
            grid: [[0], [1], [undefined]],
            rows: 3,
            cols: 1,
        });
    });

    //
    it('Can append a column to a grid with 1 row and 1 column', () => {
        expect(Model.appendCol(Model.initGrid(1, 1))).toStrictEqual({
            grid: [[undefined, undefined]],
            rows: 1,
            cols: 2,
        });
    });

    it('Can append a column to a grid with 1 row and 2 columns', () => {
        expect(Model.appendCol(Model.initGrid(1, 2))).toStrictEqual({
            grid: [[undefined, undefined, undefined]],
            rows: 1,
            cols: 3,
        });
    });

    it('Can append a column to a grid with 2 rows and 1 column', () => {
        expect(Model.appendCol(Model.initGrid(2, 1))).toStrictEqual({
            grid: [
                [undefined, undefined],
                [undefined, undefined],
            ],
            rows: 2,
            cols: 2,
        });
    });

    //
    it('Can place a viewer in a 1x1 grid', () => {
        expect(Model.placeViewer(Model.initGrid(1, 1), 0)).toStrictEqual({
            grid: [[0]],
            rows: 1,
            cols: 1,
        });
    });

    it('Can place a viewer in a filled 1x1 grid', () => {
        const grid = {
            grid: [[0]],
            rows: 1,
            cols: 1,
        };
        expect(Model.placeViewer(grid, 1)).toStrictEqual({
            grid: [[0, 1]],
            rows: 1,
            cols: 2,
        });
    });

    it('Can place a viewer in a filled 2x1 grid', () => {
        const grid = {
            grid: [[0], [1]],
            rows: 2,
            cols: 1,
        };
        expect(Model.placeViewer(grid, 2)).toStrictEqual({
            grid: [
                [0, 2],
                [1, undefined],
            ],
            rows: 2,
            cols: 2,
        });
    });

    ///
    it('Can place a viewer in a filled 1x2 grid', () => {
        const grid = {
            grid: [[0, 1]],
            rows: 1,
            cols: 2,
        };
        expect(Model.placeViewer(grid, 2)).toStrictEqual({
            grid: [
                [0, 1],
                [2, undefined],
            ],
            rows: 2,
            cols: 2,
        });
    });

    it('Can place a viewer in a partially filled 1x2 grid (A)', () => {
        const grid = {
            grid: [[0, undefined]],
            rows: 1,
            cols: 2,
        };
        expect(Model.placeViewer(grid, 1)).toStrictEqual({
            grid: [[0, 1]],
            rows: 1,
            cols: 2,
        });
    });

    it('Can place a viewer in a partially filled 1x2 grid (B)', () => {
        const grid = {
            grid: [[undefined, 0]],
            rows: 1,
            cols: 2,
        };
        expect(Model.placeViewer(grid, 1)).toStrictEqual({
            grid: [[1, 0]],
            rows: 1,
            cols: 2,
        });
    });

    //
    it('Can place a viewer in a partially filled 2x1 grid (A)', () => {
        const grid = {
            grid: [[0], [undefined]],
            rows: 2,
            cols: 1,
        };
        expect(Model.placeViewer(grid, 1)).toStrictEqual({
            grid: [[0], [1]],
            rows: 2,
            cols: 1,
        });
    });

    it('Can place a viewer in a partially filled 1x2 grid (B)', () => {
        const grid = {
            grid: [[undefined, 0]],
            rows: 1,
            cols: 2,
        };
        expect(Model.placeViewer(grid, 1)).toStrictEqual({
            grid: [[1, 0]],
            rows: 1,
            cols: 2,
        });
    });
});

describe('State', () => {
    it('Can initialise the state', () => {
        expect(Model.initState()).toStrictEqual({
            lastId: 0,
            viewers: {},
            grid: {
                grid: [[undefined]],
                rows: 1,
                cols: 1,
            },
        });
    });
});
