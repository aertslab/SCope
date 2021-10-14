declare const API_PREFIX: string;

import { Result, error, success, map } from '../result';

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

const decodeUser = (user: unknown): Result<User, string> => {
    if (user === undefined) {
        return error('User was undefined');
    }

    if (typeof user === 'object') {
        if (
            user !== null &&
            'name' in user &&
            'id' in user &&
            typeof (user as { name: unknown }).name === 'string' &&
            typeof (user as { id: unknown }).id === 'number'
        ) {
            if ('role' in user) {
                return map((role: UserRole): User => {
                    return {
                        id: (user as User).id,
                        name: (user as User).name,
                        role,
                    };
                }, decodeUserRole((user as { role: unknown }).role));
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
                return map((user: User): AuthTokenResponse => {
                    return {
                        access_token: (response as AuthTokenResponse)
                            .access_token,
                        token_type: (response as AuthTokenResponse).token_type,
                        user,
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
        const response = await fetch(API_PREFIX + 'auth/authorize', {
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
    } catch (err) {
        return error(`Unknown error: ${JSON.stringify(err)}`);
    }
}

export async function requestGuestToken(): Promise<
    Result<AuthTokenResponse, string>
> {
    try {
        const response = await fetch(API_PREFIX + 'user/new', {
            method: 'POST',
        });
        if (!response.ok) {
            return error(response.statusText);
        }
        const token: unknown = await response.json();
        return decodeAuthTokenResponse(token);
    } catch (err) {
        return error(`Unknown error: ${JSON.stringify(err)}`);
    }
}

export type Provider = {
    id: number;
    name: string;
    icon: string;
    url: string;
};

export async function requestAuthProviders(): Promise<
    Result<Array<Provider>, string>
> {
    try {
        const response = await fetch(API_PREFIX + 'auth/loginurl');
        if (!response.ok) {
            return error(response.statusText);
        }
        const providers: Array<Provider> = await response.json();
        return success(providers);
    } catch (err) {
        return error(`Unknown error: ${JSON.stringify(err)}`);
    }
}
