import React, { Component } from 'react';
import ReactTable from 'react-table';
import * as R from 'ramda';
import { Icon, Popup } from 'semantic-ui-react';

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

interface Column {
    Header: string;
    accessor: string;
    style: { whiteSpace: string };
    sortMethod?: (_x: number, _y: number) => number;
    width?: number;
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
        const magicSpacing = 7; // This number gives correct spacing based on the font size
        const cellLength = Math.max(
            ...rows.map((row) => (`${row[accessor]}` || '').length),
            headerText.length
        );
        return Math.min(maxWidth, cellLength * magicSpacing);
    };

    columnsText: Object = {
        clustering_name: 'Clustering',
        cluster_name: 'Cluster',
        n_cells: '# Cells',
        cells_in_cluster: '% Cells',
        cluster_in_cells: '% Cluster',
    };

    columnsHeaders: Object = {
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

    toColumn = (name: string): Column => {
        const numericSortCols = [
            'n_cells',
            'cells_in_cluster',
            'cluster_in_cells',
        ];

        const sort = numericSortCols.includes(name);

        return {
            Header: this.columnsHeaders[name],
            accessor: name,
            style: { whiteSpace: 'unset' },
            sortMethod: sort
                ? R.comparator((a, b) => Number(a) > Number(b))
                : undefined,
            width: sort
                ? this.getColumnWidth(
                      this.props.clusterOverlaps,
                      name,
                      this.columnsText[name]
                  )
                : undefined,
        };
    };

    clusterOverlapsColumns = R.map(this.toColumn, R.keys(this.columnsText));

    render() {
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
                        columns: this.clusterOverlapsColumns,
                    },
                ]}
                pageSizeOptions={[3, 5, 10, 15]}
                defaultPageSize={3}
                className='-striped -highlight'
            />
        );
    }
}
