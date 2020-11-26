export function makeTableData(activeLegend) {
    return activeLegend.values.map((legend, idx: number) => ({
        value: legend,
        color: activeLegend.colors[idx],
    }));
}

export function makeTableColumnData({ header, id, accessor, cell }) {
    let column = {
        Header: header,
        id: id,
    };

    if (accessor != null) {
        column['accessor'] = (d) => d[accessor];
    }

    if (cell != null) {
        column['Cell'] = (props) => cell(props);
    }
    return column;
}
