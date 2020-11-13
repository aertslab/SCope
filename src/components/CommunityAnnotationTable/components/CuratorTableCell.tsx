import React from 'react';
import * as R from 'ramda';
import { Icon, Popup } from 'semantic-ui-react';

import { makeTableColumnData } from '../model';

type CuratorTableCellProps = {
    value: {
        validated: boolean;
        curator_id: string;
        curator_name: string;
    };
};

class CuratorTableCell extends React.Component<CuratorTableCellProps> {
    constructor(props: CuratorTableCellProps) {
        super(props);
    }

    render() {
        const {
            value: { validated, curator_id, curator_name },
        } = this.props;

        let orcidIDRegex = /(?:\d{4}-){3}\d{3}[0-9,X]/;

        let iconName,
            iconColor,
            popupText = '';

        if (validated && orcidIDRegex.test(curator_id)) {
            iconName = 'check circle outline';
            iconColor = 'green';
            popupText = 'This annotation was generated on this site.';
        } else if (orcidIDRegex.test(curator_id)) {
            iconName = 'times circle outline';
            iconColor = 'red';
            popupText = 'This annotation was NOT generated on this site.';
        } else {
            iconName = 'laptop';
            iconColor = 'orange';
            popupText =
                'This annotation is not linked to an ORCID iD and is therefore likely a prediction from a tool.';
        }

        return (
            <div style={{ textAlign: 'center' }}>
                {orcidIDRegex.test(curator_id) ? (
                    <a
                        href={'https://orcid.org/' + curator_id}
                        target='_blank'
                        rel='noopener noreferrer'>
                        {curator_name}&nbsp;
                    </a>
                ) : (
                    curator_name +
                    (curator_id ? <br /> + '(' + curator_id + ')' : '')
                )}

                <Popup
                    trigger={<Icon name={iconName} color={iconColor} />}
                    content={popupText}
                />
            </div>
        );
    }
}

function asReacTableCuratorColumn() {
    return makeTableColumnData({
        header: 'Curator',
        id: 'orcid_info',
        accessor: 'orcid_info',
        cell: (value) => <CuratorTableCell {...value} />,
        sortMethod: R.comparator<any>(
            (a, b) => a.curator_name < b.curator_name
        ),
    });
}

export default CuratorTableCell;

export { asReacTableCuratorColumn };
