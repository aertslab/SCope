import React from 'react';

import { Button, Image, Popup } from 'semantic-ui-react';

type OrcidProps = {
    identifier?: string;
    name?: string;
    login: () => void;
    logout: () => void;
};

const OrcidLogin: React.FC<OrcidProps> = (props) => {
    return (
        <Popup
            trigger={
                <Button id='connect-orcid-button' onClick={props.login}>
                    <img
                        id='orcid-id-icon'
                        src='src/images/ORCIDiD_iconvector.svg'
                        alt='ORCID login button'
                        width={24}
                        height={24}
                    />
                    Authenticate with ORCID
                </Button>
            }>
            <div>
                <p>
                    By logging in with ORCID, you will be able to update and
                    vote on annotations in SCope.
                </p>
                <p>
                    ORCID provides a persistent identifier that distinguishes
                    you from other researchers and a mechanism for linking your
                    research outputs and activities to this identifier.
                    <br />
                    Learn more at{' '}
                    <a
                        href='https://orcid.org/'
                        target='_blank'
                        rel='noopener noreferrer'>
                        orcid.org
                    </a>
                </p>
            </div>
        </Popup>
    );
};

const OrcidLogout: React.FC<OrcidProps> = (props) => {
    return (
        <Popup
            trigger={
                <Button id='connect-orcid-button' onClick={props.logout}>
                    <Image
                        id='orcid-id-icon'
                        src='src/images/ORCIDiD_iconvector.svg'
                        alt='ORCID logout button'
                    />
                    Welcome {props?.name}! Logout?
                </Button>
            }>
            <div>
                <p>You are authenticated with ORCID: {props?.identifier}</p>
                <p>
                    By logging out you will no longer be able to annotate data.
                    <br />
                    Your previous annotations and votes will remain.
                </p>
            </div>
        </Popup>
    );
};

type CookieConsentProps = {
    acceptCookies: () => void;
    cookieConsent: boolean;
};

const CookieConsent: React.FC<CookieConsentProps> = (props) => {
    return (
        <Popup
            trigger={
                <Button onClick={props.acceptCookies}>
                    Click here to accept cookies.
                </Button>
            }>
            You have not accepted the use of cookies, which are required for
            ORCID login and annotation abilities.
        </Popup>
    );
};

const OrcidButton: React.FC<OrcidProps & CookieConsentProps> = (props) => {
    if (!props.cookieConsent) {
        return <CookieConsent {...props} />;
    } else if (props.name !== undefined && props.identifier !== undefined) {
        return <OrcidLogout {...props} />;
    } else {
        return <OrcidLogin {...props} />;
    }
};

export { OrcidButton, CookieConsent };
