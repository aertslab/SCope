import React from 'react';
import ReactTable from 'react-table';

import { asReactTableOBOColumn } from './components/OBOTableCell';
import { asReactTableCuratorColumn } from './components/CuratorTableCell';
import { asReactTableVotesColumn } from './components/VotesTableCell';
import { makeTableData } from './model';

type CommunityAnnotationTableProps = {
    communityAnnotations: any[];
    activeFeature: any;
    sessionIsRW: boolean;
};

const CommunityAnnotationTable: React.FC<CommunityAnnotationTableProps> = (props) => {

    const header = () => {
        return 'Community Annotations';
    }

    const columns = (activeFeature)  => {
        return [
            asReactTableOBOColumn(),
            asReactTableCuratorColumn(),
            asReactTableVotesColumn(activeFeature),
        ];
    }

        const data = makeTableData(props.communityAnnotations);

        if (props.communityAnnotations.length === 0) {
            return (
                <div
                    style={{
                        marginBottom: '5px',
                        textAlign: 'center',
                    }}>
                    No annotations currently exist.{' '}
                    {props.sessionIsRW
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
                            Header: header(),
                            columns: columns(props.activeFeature),
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
