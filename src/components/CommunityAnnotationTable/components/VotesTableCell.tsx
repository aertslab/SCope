import React from 'react';
import * as R from 'ramda';
import { BackendAPI } from '../../common/API';
import { Icon, Button, Popup } from 'semantic-ui-react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { withCookies, ReactCookieProps, Cookies } from 'react-cookie';

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
} & RouteComponentProps<{ uuid: string }>;

type VotesTableCellState = {
    status: string;
};

class VotesTableCell extends React.Component<
    VotesTableCellProps & ReactCookieProps,
    VotesTableCellState
> {
    constructor(props: VotesTableCellProps & ReactCookieProps) {
        super(props);
        this.state = {
            status: 'ready',
        };
    }

    static getORCIDData(cookies: Cookies) {
        return {
            orcidName: cookies.get('scope_orcid_name'),
            orcidID: cookies.get('scope_orcid_id'),
            orcidUUID: cookies.get('scope_orcid_uuid'),
        };
    }

    submitVote(
        communityAnnotationData: CommunityAnnotationData,
        direction: 'for' | 'against'
    ) {
        const {
            activeFeature,
            cookies,
            match: {
                params: { uuid },
            },
        } = this.props;
        let orcidData = VotesTableCell.getORCIDData(cookies);

        this.setState({ status: 'processing' });

        BackendAPI.voteAnnotation(
            direction,
            communityAnnotationData,
            activeFeature,
            orcidData,
            uuid,
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
        console.log('VOTES TABLE CELL');
        console.log(this.props);

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
                                status == 'ready' ? (
                                    votes_for.total
                                ) : (
                                    <Icon loading name='spinner' />
                                )
                            }
                        />
                    }
                    content={
                        votes_for.voters.length > 0
                            ? votes_for.voters.map((v, i) => (
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
                                status == 'ready' ? (
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

const VotesTableCellWithCookiesRouter = withCookies(withRouter(VotesTableCell));

function asReactTableVotesColumn(activeFeature) {
    return makeTableColumnData({
        header: 'Endorsements',
        id: 'votes',
        accessor: 'votes',
        cell: (props) => (
            <VotesTableCellWithCookiesRouter
                activeFeature={activeFeature}
                {...props}
            />
        ),
        sortMethod: R.comparator<any>(
            (a, b) => a.annotation_label < b.annotation_label
        ),
    });
}

export { asReactTableVotesColumn };

export default withCookies(withRouter(VotesTableCell));
