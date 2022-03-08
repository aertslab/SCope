import React from 'react';
import * as R from 'ramda';
import { BackendAPI } from '../../common/API';
import { Icon, Button, Popup } from 'semantic-ui-react';

import {
    CommunityAnnotationData,
    CommunityVotes,
    makeTableColumnData,
} from '../model';

type VotesTableCellProps = {
    value: {
        data: CommunityAnnotationData;
    } & CommunityVotes;
    activeFeature: any;
};

type VotesTableCellState = {
    status: string;
};

class VotesTableCell extends React.Component<
    VotesTableCellProps,
    VotesTableCellState
> {
    constructor(props: VotesTableCellProps) {
        super(props);
        this.state = {
            status: 'ready',
        };
    }

    submitVote(
        communityAnnotationData: CommunityAnnotationData,
        direction: 'for' | 'against'
    ) {
        const { activeFeature } = this.props;

        //TODO: `uuid` is no longer a valid concept

        this.setState({ status: 'processing' });

        BackendAPI.voteAnnotation(
            direction,
            communityAnnotationData,
            activeFeature,
            null,
            null,
            (response) => {
                console.log(response);
                this.setState({ status: 'ready' });
            }
        );
    }

    render() {
        const {
            value: { data, votes_for, votes_against },
        } = this.props;
        const { status } = this.state;

        return (
            <React.Fragment>
                <Popup
                    className='vote-tooltip'
                    trigger={
                        <Button
                            disabled={!(status === 'ready')}
                            onClick={() => this.submitVote(data, 'for')}
                            icon='thumbs up outline'
                            content={
                                status === 'ready' ? (
                                    votes_for.total
                                ) : (
                                    <Icon loading name='spinner' />
                                )
                            }
                        />
                    }
                    content={
                        votes_for.voters.length > 0
                            ? votes_for.voters.map((v) => (
                                  <span color={v.voter_hash ? 'green' : 'red'}>
                                      {'' + v.voter_name}
                                      &nbsp;&nbsp;
                                  </span>
                              ))
                            : 'None'
                    }
                />
                <Popup
                    className='vote-tooltip'
                    trigger={
                        <Button
                            disabled={!(status === 'ready')}
                            onClick={() => this.submitVote(data, 'against')}
                            icon='thumbs down outline'
                            content={
                                status === 'ready' ? (
                                    votes_against.total
                                ) : (
                                    <Icon loading name='spinner' />
                                )
                            }
                        />
                    }
                    content={
                        votes_against.voters.length > 0
                            ? votes_against.voters.map((v) => (
                                  <span color={v.voter_hash ? 'green' : 'red'}>
                                      {v.voter_name}
                                      &nbsp;&nbsp;
                                  </span>
                              ))
                            : 'None'
                    }
                />
            </React.Fragment>
        );
    }
}

export function asReactTableVotesColumn(activeFeature) {
    return makeTableColumnData({
        header: 'Endorsements',
        id: 'votes',
        accessor: 'votes',
        cell: (props) => {
            const cell = (
                <VotesTableCell
                    activeFeature={activeFeature}
                    value={props.value}
                />
            );

            return cell;
        },
        sortMethod: R.comparator<any>(
            (a, b) => a.annotation_label < b.annotation_label
        ),
    });
}

export default VotesTableCell;
