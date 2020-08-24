import { Result, success, error } from '../result';

import { BackendAPI } from '../components/common/API';
import { APIError, apiError } from './error';

declare const DEBUG: boolean;

interface FeatureQuery {
    dataset: string;
    category: string;
    query: string;
}

interface Features {
    readonly category: string;
    readonly results: readonly {
        readonly title: string;
        readonly description: string;
    }[];
}

function extractResults(
    category: string,
    err,
    response
): Result<Array<Features>, APIError> {
    if (DEBUG) {
        console.log('getFeatures response:', response, err);
    }

    if (response != null) {
        const res: any[] = [],
            genes: any[] = [],
            regulons: any[] = [],
            clusters = {},
            annotations: any[] = [],
            metrics: any[] = [];

        for (let i = 0; i < response.feature.length; i++) {
            const f = response.feature[i];
            const ft = response.featureType[i];
            const d = response.featureDescription[i];
            // Gene
            if (ft == 'gene') {
                genes.push({
                    title: f,
                    description: d,
                });
                // Regulons
            } else if (ft == 'regulon') {
                regulons.push({
                    title: f,
                    description: d,
                });
                // Annotations
            } else if (ft == 'annotation') {
                annotations.push({
                    title: f,
                    description: d,
                });
                // Metric
            } else if (ft == 'metric') {
                metrics.push({
                    title: f,
                    description: d,
                });
                // Clustering
            } else if (ft.indexOf('Clustering:') == 0) {
                if (!clusters[ft]) clusters[ft] = [];
                clusters[ft].push({
                    title: f,
                    description: d,
                });
            } else if (ft.indexOf('cluster#') == 0) {
                const cid = ft.split('#')[1];
                if (!clusters[ft])
                    clusters[ft] = {
                        category: '',
                        results: [],
                    };
                clusters[ft].push({
                    title: f,
                    description: d,
                });
            }
        }

        // Only show results for the selected result type (gene | regulon | cluster | annotation)
        if (genes.length && (category === 'all' || category === 'gene')) {
            res.push({ category: 'gene', results: genes });
        }
        if (regulons.length && (category === 'all' || category === 'regulon')) {
            res.push({ category: 'regulon', results: regulons });
        }
        if (
            (annotations.length && category === 'all') ||
            category === 'annotation'
        ) {
            res.push({ category: 'annotations', results: annotations });
        }
        if ((metrics.length && category === 'all') || category === 'metric') {
            res.push({ category: 'metric', results: metrics });
        }
        if (category === 'all' || category === 'cluster') {
            Object.keys(clusters).map((ft) => {
                res.push({
                    category: ft,
                    results: clusters[ft].slice(0, 10),
                });
            });
        }

        return success(res);
    } else {
        return error(apiError(err));
    }
}

function queryFeatures(query: FeatureQuery): Promise<[Array<Features>, any]> {
    const scopeQuery = {
        loomFilePath: query.dataset,
        query: query.query,
    };

    return new Promise<[Array<Features>, any]>((resolve, reject) => {
        BackendAPI.getConnection().then(
            (gbc) => {
                const call = gbc.services.scope.Main.getFeatures(
                    scopeQuery,
                    (err, response) => {
                        const result = extractResults(
                            query.category,
                            err,
                            response
                        );
                        if (result.kind === 'Success') {
                            resolve([result.value, call]);
                        } else {
                            reject(result.error);
                        }
                    }
                );
            },
            () => {
                reject('No connection to back-end');
            }
        );
    });
}

export { queryFeatures, FeatureQuery, Features };
