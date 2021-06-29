import React from 'react';
import ReactTable from 'react-table';
import { parse as json2csv } from 'json2csv';
import fileDownload from 'js-file-download';
import { Button } from 'semantic-ui-react';

import { asReactTableGeneColumn } from './components/MarkerTableGeneCell';
import { makeTableData, makeTableColumnData } from './model';

type FeatureMarkerTableProps = {
    history: any;
    metadata: any;
    activePage: any;
    activeFeature: any;
    activeFeatureIndex: number;
};

const FeatureMarkerTable: React.FC<FeatureMarkerTableProps> = (props) => {
    const header = () => {
        if (props.activeFeature.featureType === 'regulon') {
            return 'Regulon Genes';
        } else if (props.activeFeature.featureType.startsWith('Clustering')) {
            return 'Cluster Markers';
        }
    };

    const columns = () => {
        const markerTableColumns = [asReactTableGeneColumn({ ...props })];
        if ('metrics' in props.metadata) {
            // Add extra columns (metrics like logFC, p-value, ...)
            return [
                ...markerTableColumns,
                ...props.metadata.metrics.map((metric) =>
                    makeTableColumnData({
                        header: metric.name,
                        id: metric.accessor,
                        accessor: metric.accessor,
                        cell: null,
                    })
                ),
            ];
        }
        return markerTableColumns;
    };

    const getHeight = () => {
        return `${screen.availHeight / 4}px`;
    };

    const getDownloadButtonName = () => {
        if (props.activeFeature.featureType === 'regulon') {
            return 'Download ' + props.activeFeature.feature + ' regulon genes';
        } else if (props.activeFeature.featureType.startsWith('Clustering')) {
            return 'Download ' + props.activeFeature.feature + ' markers';
        }
    };

    const getGenesFileName = () => {
        if (props.activeFeature.featureType === 'regulon') {
            return props.activeFeature.feature + '_regulon_genes.tsv';
        } else if (props.activeFeature.featureType.startsWith('Clustering')) {
            return props.activeFeature.feature + '_markers.tsv';
        } else {
            throw Error('Unknown active feature type');
        }
    };

    const data = makeTableData(props.metadata);

    return (
        <div style={{ marginBottom: '15px', textAlign: 'center' }}>
            <ReactTable
                data={data}
                columns={[
                    {
                        Header: header(),
                        columns: columns(),
                    },
                ]}
                pageSizeOptions={[5, 10, 25, 50, 100]}
                defaultPageSize={25}
                style={{
                    height: getHeight(), // This will force the table body to overflow and scroll, since there is not enough room
                }}
                className='-striped -highlight'
            />
            <Button
                primary
                onClick={() => {
                    const tsv = json2csv(data, {
                        delimiter: '\t',
                        quote: '',
                    });
                    fileDownload(tsv, getGenesFileName());
                }}
                style={{ marginTop: '10px', width: '100%' }}>
                {getDownloadButtonName()}
            </Button>
        </div>
    );
};

export default FeatureMarkerTable;
