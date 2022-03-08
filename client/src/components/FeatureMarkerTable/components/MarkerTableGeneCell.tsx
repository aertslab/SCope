import React from 'react';

import { BackendAPI } from '../../common/API';

import { makeTableColumnData } from '../model';

type GeneTableCellProps = {
    activePage: string;
    activeFeature: any;
    activeFeatureIndex: number;
    value: string;
};

const GeneTableCell: React.FC<GeneTableCellProps> = (props) => {
    const { activeFeature, activeFeatureIndex, value } = props;

    return (
        <a
            className='pointer'
            onClick={() => {
                const query = {
                    loomFilePath: BackendAPI.getActiveLoom(),
                    query: value,
                };

                BackendAPI.getConnection().then(
                    (gbc) => {
                        gbc.services.scope.Main.getFeatures(
                            query,
                            (err, response) => {
                                BackendAPI.setActiveFeature(
                                    activeFeatureIndex,
                                    activeFeature.type,
                                    'gene',
                                    value,
                                    0,
                                    {
                                        description:
                                            response.featureDescription[0],
                                    }
                                );
                            }
                        );
                    },
                    () => {
                        BackendAPI.showError();
                    }
                );
            }}>
            {value}
        </a>
    );
};

function asReactTableGeneColumn({
    activePage,
    activeFeature,
    activeFeatureIndex,
}) {
    return makeTableColumnData({
        header: 'Gene Symbol',
        id: 'gene',
        accessor: 'gene',
        cell: (props) => {
            const cell = (
                <GeneTableCell
                    activePage={activePage}
                    activeFeature={activeFeature}
                    activeFeatureIndex={activeFeatureIndex}
                    value={props.value}
                />
            );
            return cell;
        },
    });
}

export { asReactTableGeneColumn };

export default GeneTableCell;
