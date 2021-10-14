import { AuthTokenRequest, AuthTokenResponse, Provider } from '../../api';

import * as Action from './actionTypes';

export interface RequestProviders {
    type: typeof Action.REQUEST_PROVIDERS;
}

export const requestProviders = () => {
    return {
        type: Action.REQUEST_PROVIDERS,
    };
};

export interface Providers {
    type: typeof Action.PROVIDERS;
    payload: {
        providers: Array<Provider>;
    };
}

export const providers = (providers: Array<Provider>): Providers => {
    return {
        type: Action.PROVIDERS,
        payload: { providers },
    };
};

export interface RequestToken {
    type: typeof Action.REQUEST_TOKEN;
    payload: AuthTokenRequest;
}

export const requestToken = (code: string, state: string): RequestToken => {
    return {
        type: Action.REQUEST_TOKEN,
        payload: { code, state },
    };
};

export interface AuthToken {
    type: typeof Action.AUTH_TOKEN;
    payload: AuthTokenResponse;
}

export const token = (response: AuthTokenResponse): AuthToken => {
    return {
        type: Action.AUTH_TOKEN,
        payload: response,
    };
};

export interface AuthError {
    type: typeof Action.AUTH_ERROR;
    payload: {
        message: string;
    };
}

export const error = (err: string): AuthError => {
    return {
        type: Action.AUTH_ERROR,
        payload: { message: err },
    };
};

export interface AuthGuestLogin {
    type: typeof Action.AUTH_GUEST_LOGIN;
}

export const guestLogin = () => {
    return {
        type: Action.AUTH_GUEST_LOGIN,
    };
};

export type AuthAction =
    | RequestProviders
    | Providers
    | RequestToken
    | AuthToken
    | AuthError
    | AuthGuestLogin;
