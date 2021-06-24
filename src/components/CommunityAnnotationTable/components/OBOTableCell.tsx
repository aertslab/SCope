import React from 'react';
import * as R from 'ramda';
import { Header, Icon, Label, Popup } from 'semantic-ui-react';

import { makeTableColumnData } from '../model';

type OBOTableCellProps = {
    value: {
        ols_iri: string;
        annotation_label: string;
        obo_id: string;
        markers: any;
        publication: string;
        comment: string;
    };
};

class OBOTableCell extends React.Component<OBOTableCellProps> {
    constructor(props: OBOTableCellProps) {
        super(props);
    }

    render() {
        const {
            value: {
                ols_iri,
                annotation_label,
                obo_id,
                markers,
                publication,
                comment,
            },
        } = this.props;

        const iriLink =
            ols_iri === '' ? (
                <React.Fragment>
                    {annotation_label}
                    <br />
                    {obo_id ? '(' + obo_id + ')' : ''}
                </React.Fragment>
            ) : (
                <a href={ols_iri} target='_blank' rel='noopener noreferrer'>
                    {annotation_label}
                    <br />
                    {obo_id ? '(' + obo_id + ')' : ''}
                </a>
            );

        const popupInfo = (
            <div>
                <Header as='h3'>Evidence provided for:&nbsp;{iriLink}</Header>
                <Header as='h4'>Markers</Header>
                {markers.length > 0
                    ? markers.map((m) => m).join(', ')
                    : 'None provided'}
                <Header as='h4'>Publication</Header>
                {publication ? (
                    <a href={publication}>{publication}</a>
                ) : (
                    'None provided'
                )}
                <Header as='h4'>Comment</Header>
                {comment ? comment : 'None provided'}
            </div>
        );

        return (
            <div style={{ textAlign: 'center' }}>
                {iriLink}
                <br />
                <Popup
                    trigger={
                        <Label>
                            <Icon name='question circle' />
                            More Info
                        </Label>
                    }
                    content={popupInfo}
                    on='click'
                />
            </div>
        );
    }
}

const Cell = (props) => <OBOTableCell {...props} />;

function asReactTableOBOColumn() {
    return makeTableColumnData({
        header: (
            <div>
                <p>Annotation/Ontology</p>
                <p>Term</p>
            </div>
        ),
        id: 'annotation',
        accessor: 'annotation',
        cell: Cell,
        sortMethod: R.comparator<any>(
            (a, b) => a.annotation_label < b.annotation_label
        ),
    });
}

export { asReactTableOBOColumn };

export default OBOTableCell;
