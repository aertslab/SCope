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
