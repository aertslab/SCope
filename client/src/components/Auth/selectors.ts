import { RootState } from '../../redux/reducers';
import { Provider } from '../../api';

import { Authenticated, AuthLoginReady, AuthStatus } from './model';
import { NAME } from './constants';

export const status = (state: RootState): AuthStatus => {
    return state[NAME].status;
};

export const providers = (state: RootState): Array<Provider> => {
    if (state[NAME].status === 'have_providers') {
        return (state[NAME] as AuthLoginReady).providers;
    }

    return [];
};

export const username = (state: RootState): string | null => {
    if (state[NAME].status === 'authenticated') {
        return (state[NAME] as Authenticated).user.name;
    }

    return null;
};

export const token = (state: RootState): string | null => {
    if (state[NAME].status === 'authenticated') {
        return (state[NAME] as Authenticated).token;
    }

    return null;
};
