import {
    GPROFILER_API_ENDPOINT__GENE_LIST_FUNCTIONAL_ENRICHMENT,
    GPROFILER_LINK_MAX_LENGTH,
} from './constants';

import {
    FeatureMetadata,
    FeatureMetricTable,
    GProfilerLinkRequest,
} from './types';

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

export const getMetricTable = (
    featureMetadata: FeatureMetadata
): FeatureMetricTable => {
    return featureMetadata.genes.map((gene: string, idx: number) => {
        return {
            gene,
            ...featureMetadata.metrics.reduce(
                (metrics, metric) => ({
                    ...metrics,
                    [metric.accessor]: metric.values[idx],
                }),
                {}
            ),
        };
    });
};

export const getAvailableSortBy = (featureMetadata: FeatureMetadata) => {
    return featureMetadata.metrics.map((metric, idx: number) => {
        return {
            key: idx,
            text: metric.name,
            value: metric.accessor,
        };
    });
};

const createFeatureQuery = (
    topNumFeatures: number[],
    sortedFeatureMetricTable: FeatureMetricTable
) => {
    return topNumFeatures
        .map((topNumFeaturesElement) => {
            return {
                numFeatures: topNumFeaturesElement,
                topSortedFeatures: sortedFeatureMetricTable
                    .slice(0, topNumFeaturesElement)
                    .reduce(
                        (acc, sortedFeatureMetricTableRow) => [
                            ...acc,
                            sortedFeatureMetricTableRow['gene'],
                        ],
                        []
                    )
                    .join('\n'),
            };
        })
        .reduce((acc, el) => {
            return (
                acc +
                `>Top_${el.numFeatures}` +
                '\n' +
                el.topSortedFeatures +
                '\n'
            );
        }, '');
};

const createGProfilerLink = (organism: string, query: string) => {
    const gProfilerQueryData = {
        organism,
        query,
        ordered: 'true',
        all_results: 'false',
        no_iea: 'false',
        combined: 'true',
        measure_underrepresentation: 'false',
        domain_scope: 'annotated',
        significance_threshold_method: 'g_SCS',
        user_threshold: '0.05',
        numeric_namespace: 'ENTREZGENE_ACC',
        sources: 'GO:MF,GO:CC,GO:BP,KEGG,TF,REAC,MIRNA,HPA,CORUM,HP,WP',
        background: '',
    };

    const gProfilerQueryString = Object.keys(gProfilerQueryData)
        .map((key) => {
            return (
                encodeURIComponent(key) +
                '=' +
                encodeURIComponent(gProfilerQueryData[key])
            );
        })
        .join('&');

    return `${GPROFILER_API_ENDPOINT__GENE_LIST_FUNCTIONAL_ENRICHMENT}?${gProfilerQueryString}`;
};

export const checkCreateGProfilerLink = async ({
    featureMetricTable,
    selectedTopGeneListsSizes,
    gProfilerToken,
    selectedOrganism,
    selectedSortBy,
}: GProfilerLinkRequest): Promise<{ error?: string; link?: string }> => {
    if (selectedSortBy === '') {
        return {
            error: 'Please select a sort column',
        };
    }
    if (gProfilerToken === '' && selectedOrganism === '') {
        return {
            error: 'Please select an organism',
        };
    }

    if (selectedTopGeneListsSizes.length == 0) {
        return {
            error: 'No gene list selected. At least one gene list is required.',
        };
    }

    const sortedFeatureMetricTable = featureMetricTable.sort(
        (a, b) => b[selectedSortBy] - a[selectedSortBy]
    );
    const topFeatureQuery = createFeatureQuery(
        selectedTopGeneListsSizes,
        sortedFeatureMetricTable
    );
    const organism =
        gProfilerToken !== null ? gProfilerToken : selectedOrganism;
    const gProfilerLink = createGProfilerLink(organism, topFeatureQuery);
    if (gProfilerLink.length > GPROFILER_LINK_MAX_LENGTH) {
        return {
            error:
                'Too many genes in total. Try to select a combination of gene lists with fewer genes.',
        };
    }
    return { link: gProfilerLink };
};
