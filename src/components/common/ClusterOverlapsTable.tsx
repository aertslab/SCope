import React, { Component } from 'react';
import ReactTable from 'react-table';

declare const DEBUG: boolean;

interface ClusterOverlapsTableProps {
    clusterOverlaps: Object;
}

interface ClusterOverlapsTableState {}

export default class ClusterOverlapsTable extends Component<
    ClusterOverlapsTableProps,
    ClusterOverlapsTableState
> {
    constructor(props: ClusterOverlapsTableProps) {
        super(props);
        this.state = {};
    }

    getColumnWidth = (rows, accessor, headerText) => {
        const maxWidth = 75;
        const magicSpacing = 7;
        const cellLength = Math.max(
            ...rows.map((row) => (`${row[accessor]}` || '').length),
            headerText.length
        );
        return Math.min(maxWidth, cellLength * magicSpacing);
    };

    render() {
        const columns = {
            clustering_name: 'Clustering',
            cluster_name: 'Cluster',
            n_cells: '# Cells',
            cells_in_cluster: '% Cells',
            cluster_in_cells: '% Cluster',
        };

        let clusterOverlapsColumns = [];

        for (const accessor in columns) {
            clusterOverlapsColumns.push({
                Header: columns[accessor],
                accessor: accessor,
                style: { whiteSpace: 'unset' },
                width: this.getColumnWidth(
                    this.props.clusterOverlaps,
                    accessor,
                    columns[accessor]
                ),
            });
        }
        return (
            <ReactTable
                data={this.props.clusterOverlaps}
                columns={[
                    {
                        Header: 'Selection/Cluster Overlaps',
                        columns: clusterOverlapsColumns,
                    },
                ]}
                pageSizeOptions={[3]}
                defaultPageSize={3}
                className='-striped -highlight'
            />
        );
    }
}
