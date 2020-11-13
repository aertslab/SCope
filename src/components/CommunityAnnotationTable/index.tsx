import React from 'react';
import * as R from 'ramda';
import ReactTable from 'react-table';

import { BackendAPI } from '../common/API';

import { asReacTableOBOColumn } from './components/OBOTableCell';
import { asReacTableCuratorColumn } from './components/CuratorTableCell';
import { asReacTableVotesColumn } from './components/VotesTableCell';
import { makeTableData, CommunityAnnotationTableRowData } from './model';

type CommunityAnnotationTableProps = {
    communityAnnotations: any[];
    activeFeature: any;
};

class CommunityAnnotationTable extends React.Component<
    CommunityAnnotationTableProps
> {
    private readonly data: CommunityAnnotationTableRowData[];
    private readonly activeFeature: any;

    constructor(props: CommunityAnnotationTableProps) {
        super(props);
        this.activeFeature = props.activeFeature;
    }

    getHeader() {
        return 'Community Annotations';
    }

    getColumns(activeFeature) {
        return [
            asReacTableOBOColumn(),
            asReacTableCuratorColumn(),
            asReacTableVotesColumn(activeFeature),
        ];
    }

    render() {
        const { activeFeature, communityAnnotations } = this.props;
        let data = makeTableData(communityAnnotations);

        if (communityAnnotations.length == 0) {
            return (
                <div
                    style={{
                        marginBottom: '5px',
                        textAlign: 'center',
                    }}>
                    No annotations currently exist.{' '}
                    {BackendAPI.getLoomRWStatus() == 'rw'
                        ? 'Be the first to contribute!'
                        : ''}
                </div>
            );
        }
        return (
            <div
                style={{
                    marginBottom: '15px',
                    textAlign: 'center',
                }}>
                <ReactTable
                    data={data}
                    columns={[
                        {
                            Header: this.getHeader(),
                            columns: this.getColumns(activeFeature),
                        },
                    ]}
                    pageSizeOptions={[3]}
                    defaultPageSize={3}
                    // style={{
                    // 	height: cellTypeAnnoTableHeight +"px" // This will force the table body to overflow and scroll, since there is not enough room
                    // }}
                    className='-striped -highlight'
                />
            </div>
        );
    }
}

export default CommunityAnnotationTable;
