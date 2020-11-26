import React, { Component } from 'react';
import { BackendAPI } from '../common/API';
import ReactJson from 'react-json-view';
import { Grid, Header, Popup, Button, Label, Icon } from 'semantic-ui-react';
import ReactTable from 'react-table';
import 'react-table/react-table.css';

// TODO: Hacky implementation. To be refactored/implemented properly

export default class Annotations extends Component {
    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            metadata: BackendAPI.getActiveLoomMetadata(),
        };
        this.activeLoomListener = (loom, metadata, coordinates) => {
            this.setState({ activeLoom: loom, metadata: metadata });
        };
    }

    getAllAnnotations(metadata) {
        console.log('getAllAnno');
        console.log(metadata);
        let allAnnos = [];
        for (let clustering of metadata['cellMetaData']['clusterings']) {
            for (let cluster of clustering['clusters']) {
                if (cluster['cell_type_annotation'].length > 0) {
                    for (let anno of cluster['cell_type_annotation']) {
                        allAnnos.push({
                            clustering: clustering['name'],
                            cluster: cluster['description'],
                            anno: anno,
                        });
                    }
                }
            }
        }
        return allAnnos;
    }

    render() {
        const { activeLoom, metadata } = this.state;

        let allAnnos = [];

        let newCellTypeAnnoColumn = (
            header,
            id,
            accessor,
            cell,
            sortMethod,
            filterMethod
        ) => {
            let column = {
                Header: header,
                id: id,
            };

            if (accessor != null) {
                column['accessor'] = (d) => d[accessor];
            }

            if (cell != null) {
                column['Cell'] = (props) => cell(props);
            }

            if (sortMethod != null) {
                column['sortMethod'] = sortMethod;
            }

            if (filterMethod != null) {
                column['filterMethod'] = filterMethod;
            }

            return column;
        };

        let newCellTypeAnnoTableOboCell = (props) => {
            let iriLink =
                props.value.ols_iri == '' ? (
                    <React.Fragment>
                        {props.value.annotation_label}
                        <br />
                        {props.value.obo_id
                            ? '(' + props.value.obo_id + ')'
                            : ''}
                    </React.Fragment>
                ) : (
                    <a
                        href={props.value.ols_iri}
                        target='_blank'
                        rel='noopener noreferrer'>
                        {props.value.annotation_label}
                        <br />
                        {props.value.obo_id
                            ? '(' + props.value.obo_id + ')'
                            : ''}
                    </a>
                );

            let popupInfo = (
                <div>
                    <Header as='h3'>
                        Evidence provided for:&nbsp;{iriLink}
                    </Header>
                    <Header as='h4'>Markers</Header>
                    {props.value.markers.length > 0
                        ? props.value.markers.map((m) => m).join(', ')
                        : 'None provided'}
                    <Header as='h4'>Publication</Header>
                    {props.value.publication ? (
                        <a href={props.value.publication}>
                            {props.value.publication}
                        </a>
                    ) : (
                        'None provided'
                    )}
                    <Header as='h4'>Comment</Header>
                    {props.value.comment
                        ? props.value.comment
                        : 'None provided'}
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
        };

        let newCellTypeAnnoTableCuratorCell = (props) => {
            // Match 4 sets of 4 digits, hyphen seperated with an X as a possible final check digit
            let orcidIDRegex = /(?:\d{4}-){3}\d{3}[0-9,X]/;

            let iconName,
                iconColor,
                popupText = '';

            if (
                props.value.validated &
                orcidIDRegex.test(props.value.curator_id)
            ) {
                iconName = 'check circle outline';
                iconColor = 'green';
                popupText = 'This annotation was generated on this site.';
            } else if (orcidIDRegex.test(props.value.curator_id)) {
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
                    {orcidIDRegex.test(props.value.curator_id) ? (
                        <a
                            href={'https://orcid.org/' + props.value.curator_id}
                            target='_blank'
                            rel='noopener noreferrer'>
                            {props.value.curator_name}&nbsp;
                        </a>
                    ) : (
                        props.value.curator_name +
                        (props.value.curator_id
                            ? <br /> + '(' + props.value.curator_id + ')'
                            : '')
                    )}

                    <Popup
                        trigger={<Icon name={iconName} color={iconColor} />}
                        content={popupText}
                    />
                </div>
            );
        };

        let newCellTypeAnnoTableVotesCell = (props) => {
            return (
                <React.Fragment>
                    <Popup
                        className='vote-tooltip'
                        trigger={
                            <Button
                                icon='thumbs up outline'
                                content={props.value.votes_for.total}
                            />
                        }
                        content={
                            props.value.votes_for.voters.length > 0
                                ? props.value.votes_for.voters.map((v, i) => (
                                      <font
                                          color={
                                              v.voter_hash ? 'green' : 'red'
                                          }>
                                          {'' + v.voter_name}
                                          &nbsp;&nbsp;
                                      </font>
                                  ))
                                : 'None'
                        }
                    />
                    <Popup
                        className='vote-tooltip'
                        trigger={
                            <Button
                                icon='thumbs down outline'
                                content={props.value.votes_against.total}
                            />
                        }
                        content={
                            props.value.votes_against.voters.length > 0
                                ? props.value.votes_against.voters.map((v) => (
                                      <font
                                          color={
                                              v.voter_hash ? 'green' : 'red'
                                          }>
                                          {v.voter_name}
                                          &nbsp;&nbsp;
                                      </font>
                                  ))
                                : 'None'
                        }
                    />
                </React.Fragment>
            );
        };

        let cellTypeAnnoColumns = [
            newCellTypeAnnoColumn(
                'Clustering',
                'clustering',
                'clustering',
                null,
                null,
                (filter, row) =>
                    row[filter.id].startsWith(filter.value) ||
                    row[filter.id].endsWith(filter.value) ||
                    row[filter.id].includes(filter.value)
            ),
            newCellTypeAnnoColumn(
                'Cluster',
                'cluster',
                'cluster',
                null,
                null,
                (filter, row) =>
                    row[filter.id].startsWith(filter.value) ||
                    row[filter.id].endsWith(filter.value) ||
                    row[filter.id].includes(filter.value)
            ),
            newCellTypeAnnoColumn(
                <div>
                    <nobr>Annotation/Ontology</nobr>
                    <p>Term</p>
                </div>,
                'annotation',
                'annotation',
                newCellTypeAnnoTableOboCell,
                (a, b) => {
                    if (a.annotation_label === b.annotation_label) {
                        return 0;
                    }
                    return a.annotation_label > b.annotation_label ? 1 : -1;
                },
                (filter, row) =>
                    row[filter.id].annotation_label.startsWith(filter.value) ||
                    row[filter.id].annotation_label.endsWith(filter.value) ||
                    row[filter.id].annotation_label.includes(filter.value)
            ),
            newCellTypeAnnoColumn(
                'Curator',
                'orcid_info',
                'orcid_info',
                newCellTypeAnnoTableCuratorCell,
                (a, b) => {
                    if (a.curator_name === b.curator_name) {
                        return 0;
                    }
                    return a.curator_name > b.curator_name ? 1 : -1;
                },
                (filter, row) =>
                    row[filter.id].curator_name.startsWith(filter.value) ||
                    row[filter.id].curator_name.endsWith(filter.value) ||
                    row[filter.id].curator_name.includes(filter.value)
            ),
            newCellTypeAnnoColumn(
                'Endorsements',
                'votes',
                'votes',
                newCellTypeAnnoTableVotesCell,
                (a, b) => {
                    if (a.totVotes === b.totVotes) {
                        return 0;
                    }
                    return a.totVotes > b.totVotes ? 1 : -1;
                }
            ),
        ];

        let cellTypeAnnoTableData;
        let cellTypeAnnoTable;

        if (metadata != undefined) {
            allAnnos = this.getAllAnnotations(metadata);
            cellTypeAnnoTableData = allAnnos.map((a, n) => {
                let cellTypeAnnoTableRowData = {
                    clustering: a.clustering,
                    cluster: a.cluster,
                    annotation: a.anno.data,
                    orcid_info: {
                        curator_name: a.anno.data.curator_name,
                        curator_id: a.anno.data.curator_id,
                        validated: a.anno.validate_hash,
                    },
                    votes: {
                        votes_for: a.anno.votes_for,
                        votes_against: a.anno.votes_against,
                        totVotes:
                            a.anno.votes_for.total - a.anno.votes_against.total,
                        data: a.anno.data,
                    },
                };
                return cellTypeAnnoTableRowData;
            });
        }

        let cellTypeAnnoTableHeight = screen.availHeight / 4;

        let cellTypeAnnoTableHeaderName = 'Community Annotations';

        cellTypeAnnoTable = (
            <div
                style={{
                    marginBottom: '15px',
                    align: 'center',
                }}>
                <ReactTable
                    filterable
                    data={cellTypeAnnoTableData}
                    columns={[
                        {
                            Header: cellTypeAnnoTableHeaderName,
                            columns: cellTypeAnnoColumns,
                        },
                    ]}
                    pageSizeOptions={[5, 10, 20, 50, 100]}
                    defaultPageSize={10}
                    // style={{
                    // 	height: cellTypeAnnoTableHeight +"px" // This will force the table body to overflow and scroll, since there is not enough room
                    // }}
                    className='-striped -highlight'
                />
            </div>
        );

        return (
            <Grid>
                {activeLoom && (
                    <Grid.Row>
                        <Grid.Column>
                            Active loom file: <b>{activeLoom}</b>
                            <br />
                            <br />
                            {cellTypeAnnoTableData && cellTypeAnnoTable}
                        </Grid.Column>
                    </Grid.Row>
                )}
            </Grid>
        );
    }

    UNSAFE_componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
    }
}
