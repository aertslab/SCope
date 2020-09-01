type FeatureMetadataMetric = {
    accessor: string;
    description: string;
    name: string;
    values: number[];
};

export type FeatureMetadata = {
    cellTypeAnno: unknown[];
    clusterID: number;
    clusteringGroup: string;
    clusteringID: number;
    genes: string[];
    metrics: FeatureMetadataMetric[];
};
