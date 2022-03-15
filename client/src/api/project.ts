import * as R from 'ramda';

import { Result, of, success, error } from '../result';
import { API_URL } from './api';

export type DataSet = {
    id: number;
    name: string;
    project: string; // A UUID
};

export type Project = {
    id: string; // A UUID
    name: string;
};

const decodeDataset = (project: string) => {
    return (data: unknown): Result<DataSet, string> => {
        if (data === undefined) {
            return error('Dataset was undefined');
        }

        if (typeof data === 'object') {
            if (
                data !== null &&
                'id' in data &&
                'name' in data &&
                typeof (data as { id: unknown }).id === 'number' &&
                typeof (data as { name: unknown }).name === 'string'
            ) {
                return success({
                    id: (data as { id: number }).id,
                    name: (data as { name: string }).name,
                    project,
                });
            }
        }

        return error(`${JSON.stringify(data)} is not a valid Dataset`);
    };
};

const decodeBareProject = (data: unknown): Result<Project, string> => {
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
            return success({
                id: (data as { uuid: string }).uuid,
                name: (data as { name: string }).name,
            });
        }
    }

    return error(`${JSON.stringify(data)} is not a valid bare Project`);
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
                        decodeDataset((data as { uuid: string }).uuid),
                        (data as { datasets: unknown[] }).datasets
                    )
                );
                const project = {
                    id: (data as { uuid: string }).uuid,
                    name: (data as { name: string }).name,
                };
                return R.map((datasets) => [project, datasets], datasets);
            }
        }
    }

    return error(
        `${JSON.stringify(data)} is not a valid Project with datasets`
    );
};

export const decodeProjects = (
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

            return R.map(([projs, ds]) => {
                if (ds === undefined) {
                    // The user has no projects so
                    // `datasets` is undefined here
                    return [[], []];
                } else {
                    return [projs, R.flatten(ds)];
                }
            }, unzipped);
        }
    }

    return error('Cannot decode projects');
};

export async function myProjects(
    token: string
): Promise<Result<[Array<Project>, Array<DataSet>], string>> {
    try {
        const response = await fetch(API_URL + 'user/', {
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

export async function makeProject(
    token: string,
    name: string
): Promise<Result<Project, string>> {
    try {
        const url = new URL(API_URL + 'project/new');
        url.search = new URLSearchParams({ name }).toString();
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            return error(response.statusText);
        }

        const project: unknown = await response.json();
        return decodeBareProject(project);
    } catch (err: unknown) {
        return error(`Cannot create project: ${JSON.stringify(err)}`);
    }
}

export type Coordinate = {
    x: number;
    y: number;
};

export async function getCoordinates(
    project: string,
    dataset: number
): Promise<Array<Coordinate>> {
    const url = new URL(API_URL + 'data/dataset');
    url.search = new URLSearchParams({
        project,
        dataset: `${dataset}`,
    }).toString();
    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
    });

    return (await response.json()) as Array<Coordinate>;
}
