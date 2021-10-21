export type FeatureMetadataMetric = {
    accessor: string;
    description: string;
    name: string;
    values: number[];
};

export type FeatureMetadata = {
    cellTypeAnno?: unknown[];
    clusterID?: number;
    clusteringGroup: string;
    clusteringID?: number;
    genes: string[];
    metrics?: FeatureMetadataMetric[];
    description: string;
};

export type FeatureCategory =
    | 'all'
    | 'gene'
    | 'regulon'
    | 'annotation'
    | 'metric'
    | 'cluster';

export type Feature = {
    feature: string;
    featureType: string;
    metadata: FeatureMetadata;
    threshold?: number;
    type: FeatureCategory;
};

type Voter = {
    voter_name: string;
    voter_id: string;
    voter_hash: string;
};

export type Metadata = {
    loomFilePath: string;
    cellMetaData: {
        annotations: { name: string; values: string[] }[];
        clusterings: {
            id: number;
            groupe: string;
            name: string;
            clusters: {
                id: number;
                description: string;
                cell_type_annotation: {
                    data: {
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
                    validate_hash: string;
                    votes: {
                        votes_for: {
                            total: number;
                            voters: Voter[];
                        };
                        votes_against: {
                            total: number;
                            voters: Voter[];
                        };
                    };
                }[];
            };
            clusterMarkerMetrics: {
                accessor: string;
                description: string;
                name: string;
            }[];
        }[];
    };
    fileMetaData: {
        hasClusterings: boolean;
        hasExtraEmbeddings: boolean;
        hasGeneSets: boolean;
        hasRegulonsAUC: boolean;
        hasGlobalMeta: boolean;
    };
};
