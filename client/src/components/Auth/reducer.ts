import produce from 'immer';
import { Reducer } from 'redux';

import {
    Authenticated,
    AuthError,
    AuthLoginReady,
    AuthProvidersRequested,
    initState,
    State,
} from './model';
import { AuthAction } from './actions';
import * as t from './actionTypes';

const initialState: State = initState();

export const reducer: Reducer<State, AuthAction> = produce(
    (draft: State, action: AuthAction) => {
        switch (action.type) {
            case t.REQUEST_PROVIDERS:
                (draft as AuthProvidersRequested).status = 'requested';
                break;

            case t.PROVIDERS:
                (draft as AuthLoginReady).providers = action.payload.providers;
                draft.status = 'have_providers';
                break;

            case t.AUTH_TOKEN:
                (draft as Authenticated).token = action.payload.access_token;
                (draft as Authenticated).user = action.payload.user;
                draft.status = 'authenticated';
                break;

            case t.AUTH_ERROR:
                (draft as AuthError).error = action.payload.message;
                draft.status = 'error';
                break;
        }
    },
    initialState
);
