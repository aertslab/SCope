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

class FeatureMarkerTable extends React.Component<FeatureMarkerTableProps> {
    constructor(props: FeatureMarkerTableProps) {
        super(props);
    }

    getHeader() {
        const { activeFeature } = this.props;
        if (activeFeature.featureType === 'regulon') {
            return 'Regulon Genes';
        } else if (activeFeature.featureType.startsWith('Clustering')) {
            return 'Cluster Markers';
        }
    }

    getColumns() {
        const { metadata } = this.props;
        const markerTableColumns = [asReactTableGeneColumn({ ...this.props })];
        if ('metrics' in metadata) {
            // Add extra columns (metrics like logFC, p-value, ...)
            return [
                ...markerTableColumns,
                ...metadata.metrics.map((metric) =>
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
    }

    getHeight() {
        return `${screen.availHeight / 4}px`;
    }

    getDownloadButtonName = () => {
        const { activeFeature } = this.props;
        if (activeFeature.featureType === 'regulon') {
            return 'Download ' + activeFeature.feature + ' regulon genes';
        } else if (activeFeature.featureType.startsWith('Clustering')) {
            return 'Download ' + activeFeature.feature + ' markers';
        }
    };

    getGenesFileName = () => {
        const { activeFeature } = this.props;
        if (activeFeature.featureType === 'regulon') {
            return activeFeature.feature + '_regulon_genes.tsv';
        } else if (activeFeature.featureType.startsWith('Clustering')) {
            return activeFeature.feature + '_markers.tsv';
        } else {
            throw Error('Unknown active feature type');
        }
    };

    render() {
        const { metadata } = this.props;
        const data = makeTableData(metadata);

        return (
            <div style={{ marginBottom: '15px', textAlign: 'center' }}>
                <ReactTable
                    data={data}
                    columns={[
                        {
                            Header: this.getHeader(),
                            columns: this.getColumns(),
                        },
                    ]}
                    pageSizeOptions={[5, 10, 25, 50, 100]}
                    defaultPageSize={25}
                    style={{
                        height: this.getHeight(), // This will force the table body to overflow and scroll, since there is not enough room
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
                        fileDownload(tsv, this.getGenesFileName());
                    }}
                    style={{ marginTop: '10px', width: '100%' }}>
                    {this.getDownloadButtonName()}
                </Button>
            </div>
        );
    }
}

export default FeatureMarkerTable;
