import * as R from 'ramda';

declare module 'ramda' {
    export const sequence: any;
}

declare const API_PREFIX: string;

import { Result, of, success, error } from '../result';

export type DataSet = {
    id: number;
    name: string;
    project: string; // A UUID
};

export type Project = {
    id: string; // A UUID
    name: string;
};

const decodeDataset = (data: unknown): Result<DataSet, string> => {
    if (data === undefined) {
        return error('Dataset was undefined');
    }

    if (typeof data === 'object') {
        if (
            data !== null &&
            'id' in data &&
            'name' in data &&
            'filename' in data &&
            typeof (data as { id: unknown }).id === 'number' &&
            typeof (data as { name: unknown }).name === 'string' &&
            typeof (data as { filename: unknown }).filename === 'string'
        ) {
            return success(data as DataSet);
        }
    }

    return error(`${JSON.stringify(data)} is not a valid Dataset`);
};

const decodeProject = (
    data: unknown
): Result<[Project, Array<DataSet>], string> => {
    if (data === undefined) {
        return error('Project was undefined');
    }

    if (typeof data === 'object') {
        if (
            data !== null &&
            'name' in data &&
            'uuid' in data &&
            typeof (data as { name: unknown }).name === 'string' &&
            typeof (data as { uuid: unknown }).uuid === 'string'
        ) {
            if (
                'datasets' in data &&
                typeof (data as { datasets: unknown }).datasets === 'object' &&
                'map' in (data as { datasets: unknown[] }).datasets
            ) {
                const datasets = R.sequence(
                    of,
                    R.map(
                        decodeDataset,
                        (data as { datasets: unknown[] }).datasets
                    )
                );
                const project = {
                    id: (data as { uuid: string }).uuid,
                    name: (data as { name: string }).name,
                };
                return success([project, datasets]);
            }
        }
    }

    return error(`${JSON.stringify(data)} is not a valid Project`);
};

const decodeProjects = (
    data: unknown
): Result<[Array<Project>, Array<DataSet>], string> => {
    if (data === undefined) {
        return error('List of projects was undefined');
    }

    if (typeof data === 'object') {
        if (data !== null && 'map' in data) {
            const combined: Result<
                Array<[Project, Array<DataSet>]>,
                string
            > = R.sequence(of, R.map(decodeProject, data));

            const unzipped = R.map(R.transpose, combined) as Result<
                [Array<Project>, Array<Array<DataSet>>],
                string
            >;

            return R.map(([projs, ds]) => [projs, R.flatten(ds)], unzipped);
        }
    }

    return error('Cannot decode projects');
};

export async function myProjects(
    token: string
): Promise<Result<[Array<Project>, Array<DataSet>], string>> {
    try {
        const response = await fetch(API_PREFIX + 'user/', {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            return error(response.statusText);
        }

        const projects: unknown = await response.json();
        return decodeProjects(projects);
    } catch (err: unknown) {
        return error(`Unknown error: ${JSON.stringify(err)}`);
    }
}
