import React from 'react';
import ReactTable from 'react-table';

import { makeTableData, makeTableColumnData } from './model';

type LegendTableProps = {
    activeLegend: any;
};

const LegendTableColorCell = (props) => {
    const colorLegendStyle = {
        width: '25px',
        height: '25px',
        '-webkit-mask-box-image': "url('src/images/dot.png')",
        backgroundColor: '#' + props.value,
    };
    return <div style={colorLegendStyle}></div>;
};

class FeatureMarkerTable extends React.Component<LegendTableProps> {
    constructor(props: LegendTableProps) {
        super(props);
    }

    getHeader() {
        return 'Legend';
    }

    getColumns() {
        return [
            makeTableColumnData({
                header: 'Value',
                id: 'value',
                accessor: 'value',
                cell: null,
            }),
            makeTableColumnData({
                header: 'Color',
                id: 'color',
                accessor: 'color',
                cell: LegendTableColorCell,
            }),
        ];
    }

    render() {
        const { activeLegend } = this.props;
        const data = makeTableData(activeLegend);

        return (
            <div style={{ marginBottom: '15px' }}>
                <ReactTable
                    data={data}
                    columns={[
                        {
                            Header: this.getHeader(),
                            columns: this.getColumns(),
                        },
                    ]}
                    pageSizeOptions={[5, 10, 20]}
                    defaultPageSize={10}
                    className='-striped -highlight'
                />
            </div>
        );
    }
}

export default FeatureMarkerTable;
