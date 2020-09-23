import React from 'react';
import { Checkbox, Table } from 'semantic-ui-react';

import './GProfilerModal.css';

export const TopGeneListsSelectionTable: React.FC<{
    availableTopGeneListsSizes: number[];
    selectedTopGeneListsSizes: number[];
    onSelectGeneList: (geneListSize: number) => () => void;
}> = ({
    availableTopGeneListsSizes,
    selectedTopGeneListsSizes,
    onSelectGeneList,
}) => {
    return (
        <Table compact celled definition>
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell />
                    <Table.HeaderCell>
                        Gene list with number of top features to use
                    </Table.HeaderCell>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {availableTopGeneListsSizes.map((topGeneListsSize) => {
                    const handleOnChangeGeneList = onSelectGeneList(
                        topGeneListsSize
                    );

                    const isSelected = selectedTopGeneListsSizes.includes(
                        topGeneListsSize
                    );

                    return (
                        <Table.Row key={`tgls-${topGeneListsSize}`}>
                            <Table.Cell collapsing>
                                <Checkbox onChange={handleOnChangeGeneList} />
                            </Table.Cell>
                            <Table.Cell>
                                {isSelected ? (
                                    <span className='geneListSelected'>{`Top ${topGeneListsSize}`}</span>
                                ) : (
                                    <span className='geneListUnselected'>{`Top ${topGeneListsSize}`}</span>
                                )}
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
};
