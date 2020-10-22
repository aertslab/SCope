import React from 'react';
import {
    Button,
    Dimmer,
    Header,
    Loader,
    Icon,
    Segment,
} from 'semantic-ui-react';

interface NotificationStatus {
    starting: boolean;
    connected: boolean;
    tooManyUsers: boolean;
    timeout: boolean;
}

function notify(active: boolean, message: string) {
    return (
        <Dimmer active={active}>
            <br />
            <br />
            <Icon name='warning circle' color='orange' size='big' />
            <br />
            <br />
            <Header as='h2' inverted>
                {message}
                <br />
                <br />
                If this error persists, please try a local install from our{' '}
                <a
                    href='https://github.com/aertslab/SCope'
                    target='_blank'
                    rel='noopener noreferrer'>
                    Github page
                </a>{' '}
                or try our{' '}
                <a
                    href='http://scope-mirror.aertslab.org/'
                    target='_blank'
                    rel='noopener noreferrer'>
                    SCope mirror
                </a>
                .<br />
                <br />
                <Button
                    color='orange'
                    onClick={() => {
                        window.location.reload();
                    }}>
                    REFRESH
                </Button>
            </Header>
        </Dimmer>
    );
}

function FullPageNotify(props: NotificationStatus) {
    return (
        <React.Fragment>
            {notify(
                !props.connected,
                'Cannot connect to SCope back-end: please check your internet connection.'
            )}
            {notify(props.tooManyUsers, 'There are too many concurrent users.')}
            {notify(props.timeout, 'Your SCope session has ended.')},
            <Dimmer active={props.starting} inverted>
                <Loader inverted>Your SCope session is starting...</Loader>
            </Dimmer>
        </React.Fragment>
    );
}

export { FullPageNotify };
