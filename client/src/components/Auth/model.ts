import { Provider, User } from '../../api';

export type AuthInit = {
    status: 'uninitialised';
};

export type AuthProvidersRequested = {
    status: 'requested_providers';
};

export type AuthLoginReady = {
    status: 'have_providers';
    providers: Array<Provider>;
};

export type AuthTokenRequested = {
    status: 'requested_token';
};

export type Authenticated = {
    status: 'authenticated';
    token: string;
    user: User;
};

export type AuthError = {
    status: 'error';
    error: string;
};

export type State =
    | AuthInit
    | AuthProvidersRequested
    | AuthLoginReady
    | AuthTokenRequested
    | Authenticated
    | AuthError;

export type AuthStatus = State['status'];

export const initState = (): State => {
    return {
        status: 'uninitialised',
    };
};
