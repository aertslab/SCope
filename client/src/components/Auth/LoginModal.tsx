import React from 'react';
import { useDispatch } from 'react-redux';
import { Button, Modal } from 'semantic-ui-react';

import { Provider } from '../../api';

import * as Action from './actions';

type LoginModalProps = {
    providers: Array<Provider>;
};

export const LoginModal: React.FC<LoginModalProps> = (
    props: LoginModalProps
) => {
    const dispatch = useDispatch();

    const guestLogin = () => {
        dispatch(Action.guestLogin());
    };

    return (
        <Modal open>
            <Modal.Header>Login</Modal.Header>
            <Modal.Content>
                <Button onClick={() => guestLogin()}>
                    Continue as a guest user
                </Button>
                {props.providers.map((provider: Provider) => {
                    return (
                        <Button key={provider.id} href={provider.url}>
                            {provider.name}
                        </Button>
                    );
                })}
            </Modal.Content>
        </Modal>
    );
};
