export type State = {
    orcid_name: string;
    orcid_id: string;
    orcid_uuid: string;
    status: string;
};

type CommunityVoter = {
    voter_name: string;
    voter_id: string;
    voter_hash: string;
};

export type CommunityAnnotationData = {
    curator_name: string;
    curator_id: string;
    timestamp: number;
    obo_id: string;
    ols_iri: string;
    annotation_label: string;
    markers: string[];
    publication: string;
    comment: string;
};

export type CommunityVotes = {
    votes_for: {
        total: number;
        voters: CommunityVoter[];
    };
    votes_against: {
        total: number;
        voters: CommunityVoter[];
    };
};

export type CommunityAnnotation = {
    data: CommunityAnnotationData;
    validate_hash: string;
} & CommunityVotes;

export type CommunityAnnotationTableRowData = {
    annotation: CommunityAnnotationData;
    orcid_info: {
        curator_name: string;
        curator_id: string;
        validated: string;
    };
    votes: {
        votes_for: {
            total: number;
            voters: CommunityVoter[];
        };
        votes_against: {
            total: number;
            voters: CommunityVoter[];
        };
        totVotes: number;
        data: CommunityAnnotationData;
    };
};

export function makeTableColumnData({
    header,
    id,
    accessor,
    cell,
    sortMethod,
}) {
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
    if (sortMethod !== null) {
        column['sortMethod'] = sortMethod;
    }
    return column;
}

export function makeTableData(
    communityAnnotations: CommunityAnnotation[]
): CommunityAnnotationTableRowData[] {
    return communityAnnotations.map((communityAnnotation) => {
        return {
            annotation: communityAnnotation.data,
            orcid_info: {
                curator_name: communityAnnotation.data.curator_name,
                curator_id: communityAnnotation.data.curator_id,
                validated: communityAnnotation.validate_hash,
            },
            votes: {
                votes_for: communityAnnotation.votes_for,
                votes_against: communityAnnotation.votes_against,
                totVotes:
                    communityAnnotation.votes_for.total -
                    communityAnnotation.votes_against.total,
                data: communityAnnotation.data,
            },
        };
    });
}
