import { Result, success, error } from '../result';

import { LegacyAPI } from './';
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

function queryFeatures(query: FeatureQuery): Promise<Array<Features>> {
    const scopeQuery = {
        loomFilePath: query.dataset,
        query: query.query,
        filter: query.category,
    };

    return new Promise<Array<Features>>((resolve, reject) => {
        LegacyAPI.getConnection().then(
            (gbc) => {
                gbc.services.scope.Main.getFeatures(
                    scopeQuery,
                    (err, response) => {
                        if (response) {
                            resolve(response.features);
                        } else {
                            resolve([]);
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
