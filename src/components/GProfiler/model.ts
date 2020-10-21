export type State = {
    error: string;
    display: boolean;
    /**
     * Array of number representing the selected gene list sizes. Theses sizes will be used to extract and c
     * create selectedTopGeneListsSizes.length gene lists that will be send to g:Profilter to perform
     * gene list functional enrichment
     */
    selectedTopGeneListsSizes: number[];
    availableOrganisms: GProfilerOrganism[];
    isFetchingAvailableOrganisms: boolean;
    selectedOrganism: string;
    selectedSortBy: string;
    gProfilerToken: string;
};

type FeatureMetadataMetric = {
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
    genes?: string[];
    metrics?: FeatureMetadataMetric[];
    description: string;
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

export const getNumFeatures = (featureMetadata: FeatureMetadata) => {
    return featureMetadata.genes.length;
};

export const getAvailableTopGeneListsSizes = (
    featureMetadata: FeatureMetadata
) => {
    const numFeatures = getNumFeatures(featureMetadata);
    return [
        numFeatures < 100 ? numFeatures : 100,
        200,
        300,
        400,
        500,
    ].filter((topNumFeaturesValue) =>
        topNumFeaturesValue <= numFeatures ? true : false
    );
};

const reduceMetricsAtIndex = (idx: number) => (
    metrics,
    metric: FeatureMetadataMetric
) => ({
    ...metrics,
    [metric.accessor]: metric.values[idx],
});

export const getMetricTable = (
    featureMetadata: FeatureMetadata
): FeatureMetricTable => {
    if (featureMetadata.genes) {
        return featureMetadata.genes.map((gene: string, idx: number) => {
            return {
                gene,
                ...featureMetadata.metrics.reduce(
                    reduceMetricsAtIndex(idx),
                    {}
                ),
            };
        });
    }

    return [];
};

export const getAvailableSortBy = (featureMetadata: FeatureMetadata) => {
    if (featureMetadata.metrics) {
        return featureMetadata.metrics.map((metric, idx: number) => {
            return {
                key: idx,
                text: metric.name,
                value: metric.accessor,
            };
        });
    }

    return [];
};
