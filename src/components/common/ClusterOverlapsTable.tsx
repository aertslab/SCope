import React, { Component } from 'react';
import ReactTable from 'react-table';
import * as R from 'ramda';
import { Icon, Popup } from 'semantic-ui-react';

declare const DEBUG: boolean;

interface ClusterOverlaps {
    clustering_name: string;
    cluster_name: string;
    n_cells: number;
    cells_in_cluster: number;
    cluster_in_cells: number;
}

interface SortOptions {
    id: string;
    desc: boolean;
}
interface ClusterOverlapsTableProps {
    clusterOverlaps: ClusterOverlaps[];
}

interface ClusterOverlapsTableState {
    sortOptions: Array<SortOptions>;
}

export default class ClusterOverlapsTable extends Component<
    ClusterOverlapsTableProps,
    ClusterOverlapsTableState
> {
    constructor(props: ClusterOverlapsTableProps) {
        super(props);
        this.state = {
            sortOptions: [
                { id: 'cells_in_cluster', desc: false },
                { id: 'cluster_in_cells', desc: false },
            ],
        };
    }

    getColumnWidth = (
        rows: ClusterOverlaps[],
        accessor: string,
        headerText: string
    ) => {
        const maxWidth = 90;
        const magicSpacing = 7;
        const cellLength = Math.max(
            ...rows.map((row) => (`${row[accessor]}` || '').length),
            headerText.length
        );
        return Math.min(maxWidth, cellLength * magicSpacing);
    };

    render() {
        const columnsText = {
            clustering_name: 'Clustering',
            cluster_name: 'Cluster',
            n_cells: '# Cells',
            cells_in_cluster: '% Cells',
            cluster_in_cells: '% Cluster',
        };

        const columnsHeaders = {
            clustering_name: 'Clustering',
            cluster_name: 'Cluster',
            n_cells: '# Cells',
            cells_in_cluster: (
                <React.Fragment>
                    % Cells
                    <br />
                    <Popup
                        basic
                        content='The percentage of the selected cells within the cluster'
                        position='top left'
                        trigger={
                            <Icon
                                name='question circle'
                                style={{ display: 'inline' }}
                                className='pointer'
                            />
                        }
                    />
                </React.Fragment>
            ),
            cluster_in_cells: (
                <React.Fragment>
                    % Cluster
                    <br />
                    <Popup
                        basic
                        content='The percentage of the cluster within the selection'
                        position='top left'
                        trigger={
                            <Icon
                                name='question circle'
                                style={{ display: 'inline' }}
                                className='pointer'
                            />
                        }
                    />
                </React.Fragment>
            ),
        };

        let clusterOverlapsColumns = [];

        const numericSortCols = [
            'n_cells',
            'cells_in_cluster',
            'cluster_in_cells',
        ];

        for (const accessor in columnsText) {
            let column = {
                Header: columnsHeaders[accessor],
                accessor: accessor,
                style: { whiteSpace: 'unset' },
                width: this.getColumnWidth(
                    this.props.clusterOverlaps,
                    accessor,
                    columnsText[accessor]
                ),
            };

            if (numericSortCols.includes(accessor)) {
                column['sortMethod'] = R.comparator(
                    (a, b) => Number(a) > Number(b)
                );
            }
            clusterOverlapsColumns.push(column);
        }

        return (
            <ReactTable
                data={this.props.clusterOverlaps}
                sorted={this.state.sortOptions}
                onSortedChange={(val) => {
                    this.setState({ sortOptions: val });
                }}
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
