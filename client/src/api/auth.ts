import * as R from 'ramda';

import { Result, error, success, map, of } from '../result';
import { Project, DataSet, decodeProjects } from './project';
import { handleError } from './err';
import { API_URL } from './api';

const USER_ROLES = ['guest', 'user', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export type AuthTokenRequest = {
    code: string;
    state: string;
};

export type User = {
    name: string;
    role: UserRole;
    id: number;
};

export type AuthTokenResponse = {
    access_token: string;
    token_type: string;
    user: User;
    projects: Array<Project>;
    datasets: Array<DataSet>;
};

export const decodeUserRole = (role: unknown): Result<UserRole, string> => {
    if (
        typeof role === 'string' &&
        (USER_ROLES as unknown as string[]).includes(role)
    ) {
        return success(role as UserRole);
    }

    return error(`Cannot decode ${role} to a UserRole`);
};

const decodeUser = (
    user: unknown
): Result<[User, Array<Project>, Array<DataSet>], string> => {
    if (user === undefined) {
        return error('User was undefined');
    }

    if (typeof user === 'object') {
        if (
            user !== null &&
            'name' in user &&
            'id' in user &&
            'projects' in user &&
            typeof (user as { name: unknown }).name === 'string' &&
            typeof (user as { id: unknown }).id === 'number'
        ) {
            if ('role' in user) {
                return decodeProjects(
                    (user as { projects: unknown }).projects
                ).chain(([prjs, ds]) => {
                    return map(
                        (
                            role: UserRole
                        ): [User, Array<Project>, Array<DataSet>] => {
                            return [
                                {
                                    id: (user as User).id,
                                    name: (user as User).name,
                                    role,
                                },
                                prjs,
                                ds,
                            ];
                        },
                        decodeUserRole((user as { role: unknown }).role)
                    );
                });
            }
        }
    }

    return error(`${JSON.stringify(user)} is not a valid User`);
};

const decodeAuthTokenResponse = (
    response: unknown
): Result<AuthTokenResponse, string> => {
    if (response === undefined) {
        return error('Token response was undefined');
    }

    if (typeof response === 'object') {
        if (
            response !== null &&
            'access_token' in response &&
            'token_type' in response &&
            typeof (response as { access_token: unknown }).access_token ===
                'string' &&
            typeof (response as { token_type: unknown }).token_type === 'string'
        ) {
            if ('user' in response) {
                return map(([user, prjs, ds]): AuthTokenResponse => {
                    return {
                        access_token: (response as AuthTokenResponse)
                            .access_token,
                        token_type: (response as AuthTokenResponse).token_type,
                        user,
                        projects: prjs,
                        datasets: ds,
                    };
                }, decodeUser((response as { user: unknown }).user));
            }
        }
    }

    return error(
        `${JSON.stringify(response)} is not a valid AuthTokenResponse`
    );
};

export async function requestAuthToken(
    req: AuthTokenRequest
): Promise<Result<AuthTokenResponse, string>> {
    try {
        const response = await fetch(API_URL + 'auth/authorize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req),
        });
        if (!response.ok) {
            return error(response.statusText);
        }
        const token: unknown = await response.json();
        return decodeAuthTokenResponse(token);
    } catch (err: unknown) {
        return handleError('Error in AuthToken request:', err);
    }
}

export async function requestGuestToken(): Promise<
    Result<AuthTokenResponse, string>
> {
    try {
        const response = await fetch(API_URL + 'user/new', {
            method: 'POST',
        });
        if (!response.ok) {
            return error(response.statusText);
        }
        const token: unknown = await response.json();
        return decodeAuthTokenResponse(token);
    } catch (err) {
        return handleError('Error in guest AuthToken request:', err);
    }
}

export type Provider = {
    id: number;
    name: string;
    icon: string;
    url: string;
};

const decodeProvider = (data: unknown): Result<Provider, string> => {
    if (data === undefined) {
        return error('Provider was undefined');
    }

    if (
        typeof data === 'object' &&
        data !== null &&
        'id' in data &&
        'name' in data &&
        'icon' in data &&
        'url' in data &&
        typeof (data as { id: unknown }).id === 'number' &&
        typeof (data as { name: unknown }).name === 'string' &&
        (typeof (data as { icon: unknown }).icon === 'string' ||
            (data as { icon: unknown }).icon === null) &&
        typeof (data as { url: unknown }).url === 'string'
    ) {
        const provider: Provider = {
            id: (data as { id: number }).id,
            name: (data as { name: string }).name,
            icon: (data as { icon: string }).icon,
            url: (data as { url: string }).url,
        };
        return success(provider);
    }

    return error(`${JSON.stringify(data)} is not a valid provider`);
};

const decodeProviders = (data: unknown): Result<Array<Provider>, string> => {
    if (data === undefined) {
        return error('List of providers was undefined');
    }

    if (typeof data === 'object' && data !== null && 'map' in data) {
        return R.sequence(of, R.map(decodeProvider, data));
    }

    return error(`Cannot decode list of providers: ${JSON.stringify(data)}`);
};

export async function requestAuthProviders(): Promise<
    Result<Array<Provider>, string>
> {
    try {
        const response = await fetch(API_URL + 'auth/loginurl');
        if (!response.ok) {
            return error(response.statusText);
        }
        const providers: unknown = await response.json();
        return decodeProviders(providers);
    } catch (err) {
        return handleError('Error requesting auth providers:', err);
    }
}
