export function makeTableData(metadata) {
    return metadata.genes.map((gene, idx) => {
        const markerTableRowData = { gene };
        if (metadata?.metrics) {
            for (const metric of metadata.metrics) {
                markerTableRowData[metric.accessor] = metric.values[idx];
            }
        }
        return markerTableRowData;
    });
}

export function makeTableColumnData({ header, id, accessor, cell }) {
    const column = {
        Header: header,
        id: id,
    };

    if (accessor !== null) {
        column['accessor'] = (d) => d[accessor];
    }

    if (cell !== null) {
        column['Cell'] = (props) => cell(props);
    }
    return column;
}
