import { LegacyAPI } from './';

type FeatureQuery = {
    readonly dataset: string;
    readonly category: string;
    readonly query: string;
};

type Features = {
    readonly category: string;
    readonly results: readonly {
        readonly title: string;
        readonly description: string;
    }[];
};

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
