import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Icon } from 'semantic-ui-react';

import { RootState } from '../../redux/reducers';
import { Provider } from '../../api';

import { LoginModal } from './LoginModal';
import { AuthStatus } from './model';
import * as Action from './actions';
import * as Selector from './selectors';

type AuthPanelState = {
    status: AuthStatus;
    providers: Array<Provider>;
    username: string | null;
};

const AuthPanel: React.FC<{}> = () => {
    const dispatch = useDispatch();
    const state: AuthPanelState = useSelector<RootState, AuthPanelState>(
        (root: RootState) => {
            return {
                status: Selector.status(root),
                providers: Selector.providers(root),
                username: Selector.username(root),
            };
        }
    );

    useEffect(() => {
        if (state.status === 'uninitialised') {
            dispatch(Action.requestProviders());
        }
    });

    if (state.status === 'have_providers') {
        return <LoginModal providers={state.providers} />;
    } else if (state.status === 'authenticated') {
        return (
            <Button icon labelPosition='left'>
                <Icon name='user' />
                Welcome {state.username}
            </Button>
        );
    } else {
        return <div>Auth Panel: {state.status}</div>;
    }
};

export { AuthPanel };
