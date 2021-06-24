import React from 'react';
import * as R from 'ramda';
import { withRouter, RouteComponentProps } from 'react-router-dom';

import { BackendAPI } from '../../common/API';

import { makeTableColumnData } from '../model';

type GeneTableCellProps = {
    history: any;
    activePage: string;
    activeFeature: any;
    activeFeatureIndex: number;
    value: string;
} & RouteComponentProps<{ uuid: string; loom: string }>;

class GeneTableCell extends React.Component<GeneTableCellProps> {
    constructor(props: GeneTableCellProps) {
        super(props);
    }

    render() {
        const {
            match: {
                params: { uuid, loom },
            },
            history,
            activePage,
            activeFeature,
            activeFeatureIndex,
            value,
        } = this.props;

        return (
            <a
                className='pointer'
                onClick={() => {
                    const query = {
                        loomFilePath: BackendAPI.getActiveLoom(),
                        query: value,
                    };
                    if (activePage === 'regulon') {
                        this.setState({ currentPage: 'gene' });
                        BackendAPI.setActivePage('gene');
                        history.push(
                            '/' + [uuid, loom ? loom : '*', 'gene'].join('/')
                        );
                    }
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
    }
}

const GeneTableCellWithRouter = withRouter(GeneTableCell);

function asReactTableGeneColumn({
    history,
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
                <GeneTableCellWithRouter
                    history={history}
                    activePage={activePage}
                    activeFeature={activeFeature}
                    activeFeatureIndex={activeFeatureIndex}
                    {...props}
                />
            );
            return cell;
        },
    });
}

export { asReactTableGeneColumn };

export default withRouter(GeneTableCell);
