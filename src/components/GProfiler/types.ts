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

export type FeatureMetricTable = {
    gene: string;
    avg_logFC?: number;
    pval?: number;
}[];

export type GProfilerOrganism = {
    display_name: string;
    id: string;
    scientific_name: string;
    version: string;
};

export type GProfilerLinkRequest = {
    featureMetricTable: FeatureMetricTable;
    selectedTopGeneListsSizes: number[];
    gProfilerToken: string;
    selectedOrganism: string;
    selectedSortBy: string;
};
