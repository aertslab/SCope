import { PropTypes, instanceOf } from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { withRouter, Route, Link } from 'react-router-dom';
import { withCookies, Cookies } from 'react-cookie';
import CookieConsent from 'react-cookie-consent';
import pako from 'pako';
import Favicon from 'react-favicon';

import { SCOPE_COOKIE, ONE_MINUTE } from './constants';

import { BackendAPI } from './common/API';
import { SessionLoading, Main } from './Main';
import Alert from 'react-popup';
import 'react-popup/style.css';

import {
    setAppLoading,
    setUUID,
    setSessionMode,
    consentToCookies,
} from '../redux/actions';

import { FullPageNotify } from './pages';
import { millisecondsToDays } from './utils';

const publicIp = require('public-ip');
const timer = 60 * 1000;

class App extends Component {
    constructor() {
        super();
        this.state = {
            metadata: null,
            loaded: false,
            error: false,
            sessionsLimitReached: false,
            orcid_active: true,
            orcid_data: null,
        };

        BackendAPI.getORCIDStatus((active) => {
            this.setState({ orcid_active: active });
        });

        this.timeout = null;
        this.mouseClicks = 0;
        this.timeFormatter = new Intl.RelativeTimeFormat(navigator.language);
    }

    removeAllCookies() {
        this.props.cookies.remove('scope_orcid_name');
        this.props.cookies.remove('scope_orcid_id');
        this.props.cookies.remove('scope_orcid_uuid');
        this.props.cookies.remove(SCOPE_COOKIE);
    }

    acceptCookies() {
        this.props.cookies.set('CookieConsent', 'true');
        this.setUUIDCookie();
        this.props.consentToCookies();
    }

    setUUIDCookie() {
        this.props.cookies.set(SCOPE_COOKIE, this.props.match.params.uuid, {
            path: '/',
            sameSite: 'strict',
        });
    }

    render() {
        const { metadata, error, loaded, sessionsLimitReached } = this.state;

        const {
            isAppLoading,
            uuid,
            sessionMode,
            sidebarIsVisible,
        } = this.props;

        return (
            <React.Fragment>
                <Favicon url='src/images/SCope_favicon.ico' />
                <Route exact path='/'>
                    <SessionLoading />
                </Route>
                <Route path='/:uuid/:loom?/:page?'>
                    <Main
                        loaded={loaded}
                        timeout={this.timeFormatter.format(
                            Math.round(millisecondsToDays(this.timeout)),
                            'day'
                        )}
                        cookies={this.props.cookies}
                    />
                </Route>
                <FullPageNotify
                    starting={isAppLoading}
                    connected={!error}
                    tooManyUsers={!isAppLoading && sessionsLimitReached}
                    timeout={
                        !isAppLoading &&
                        this.timeout !== null &&
                        this.timeout <= 0
                    }
                />
                <CookieConsent
                    enableDeclineButton
                    onDecline={() => {
                        this.removeAllCookies();
                    }}
                    onAccept={() => this.acceptCookies()}>
                    This website uses cookies to enhance the user experience and
                    to store user information for annotation and access
                    purposes.
                </CookieConsent>
                <Alert />{' '}
                {/* Needed for react popup to function. Do not remove */}
            </React.Fragment>
        );
    }

    componentDidMount() {
        this.parseURLParams(this.props);
        this.getUUIDFromIP(this.props);

        if (this.props.cookies.get('CookieConsent') === 'true') {
            this.props.consentToCookies();

            if (
                document.head.querySelector('[name=scope-orcid]') !== null &&
                this.state.orcid_active
            ) {
                const auth_code = document.head
                    .querySelector('[name=scope-orcid]')
                    .getAttribute('auth');

                BackendAPI.getORCID(
                    auth_code,
                    (orcid_scope_uuid, name, orcid_id) => {
                        this.props.cookies.set(
                            'scope_orcid_uuid',
                            orcid_scope_uuid
                        );
                        this.props.cookies.set('scope_orcid_name', name);
                        this.props.cookies.set('scope_orcid_id', orcid_id);
                        // Possibly a bit hacky, but it works to remove the code from the URL
                        location.href =
                            location.origin + location.pathname + location.hash;
                    }
                );
            }
        }
        document.addEventListener('click', this.clickHandler.bind(this));
        document.addEventListener('keypress', this.clickHandler.bind(this));
    }

    clickHandler() {
        this.mouseClicks += 1;
        if (DEBUG) {
            console.log('User click', this.mouseClicks);
        }
    }

    componentWillUnmount() {
        if (this.timer) {
            clearInterval(this.timer);
        }

        document.removeEventListener('click', this.clickHandler);
        document.removeEventListener('keypress', this.clickHandler);
    }

    componentDidUpdate(prevProps) {
        this.parseURLParams(this.props);
        if (prevProps.match.params.uuid !== this.props.match.params.uuid) {
            this.getUUIDFromIP(this.props);
        }
    }

    parseURLParams(props) {
        let loom = decodeURIComponent(props.match.params.loom);
        let page = decodeURIComponent(props.match.params.page);
        if (DEBUG) {
            console.log('Query params - loom: ', loom, ' page: ', page);
        }
        BackendAPI.setActivePage(page ? page : 'welcome');
        BackendAPI.setActiveLoom(loom ? loom : '');
    }

    getUUIDFromIP(props) {
        publicIp.v4().then(
            (ip) => {
                this.getUUID(props, ip);
            },
            () => {
                this.getUUID(props);
            }
        );
    }

    getUUID(props, ip) {
        const { cookies, match } = props;

        if (match.params.uuid) {
            if (match.params.uuid === 'permalink') {
                if (DEBUG) {
                    console.log('Permalink detected');
                }
                this.restoreSession(
                    ip,
                    cookies.get(SCOPE_COOKIE),
                    match.params.loom
                );
            } else if (match.params.uuid.startsWith('permalink')) {
                this.restoreSession(
                    ip,
                    match.params.uuid.substring(11),
                    match.params.loom
                );
            } else {
                if (DEBUG) {
                    console.log('Params UUID detected:', match.params.uuid);
                    console.log(
                        'cookieConsent state:',
                        this.props.cookieConsent
                    );
                    console.log(
                        'SCOPE_COOKIE:',
                        SCOPE_COOKIE,
                        match.params.uuid,
                        { path: '/' }
                    );
                }
                this.checkUUID(ip, match.params.uuid);

                if (this.props.cookieConsent) {
                    this.setUUIDCookie();
                }
            }
        } else if (cookies.get(SCOPE_COOKIE)) {
            if (DEBUG) {
                console.log('Cookie UUID detected:', cookies.get(SCOPE_COOKIE));
            }
            this.checkUUID(ip, cookies.get(SCOPE_COOKIE));
        } else {
            if (DEBUG) {
                console.log('No UUID detected');
            }
            this.obtainNewUUID(ip, (uuid) => {
                this.checkUUID(ip, uuid);
            });
        }
    }

    obtainNewUUID(ip, onSuccess) {
        BackendAPI.getConnection().then(
            (gbc) => {
                let query = {
                    ip: ip,
                };
                if (DEBUG) {
                    console.log('getUUID', query);
                }
                gbc.services.scope.Main.getUUID(query, (err, response) => {
                    if (DEBUG) {
                        console.log('getUUID', response);
                    }
                    if (response !== null) {
                        onSuccess(response.UUID);
                    }
                });
            },
            () => {
                this.setState({ error: true });
            }
        );
    }

    checkUUID(ip, uuid, ping) {
        const { cookies, history, match } = this.props;
        if (!uuid) {
            return;
        }
        BackendAPI.getConnection().then(
            (gbc, ws) => {
                let query = {
                    ip: ip,
                    UUID: uuid,
                    mouseEvents: this.mouseClicks,
                };
                gbc.ws.onclose = (err) => {
                    this.setState({ error: true });
                };
                if (DEBUG) {
                    console.log('request RemainingUUIDTime', query);
                }
                gbc.services.scope.Main.getRemainingUUIDTime(
                    query,
                    (err, response) => {
                        this.mouseClicks = 0;
                        if (DEBUG) {
                            console.log('getRemainingUUIDTime', response);
                        }
                        if (response.sessionsLimitReached) {
                            this.props.setAppLoading(false);
                            this.setState({
                                sessionsLimitReached: true,
                            });
                        } else {
                            this.timeout = response
                                ? parseInt(response.timeRemaining * 1000)
                                : 0;
                            console.log('Timeout:', this.timeout);

                            if (!ping) {
                                this.props.setAppLoading(false);
                                this.props.setUUID(uuid);
                                this.props.setSessionMode(response.sessionMode);
                            }
                            if (!this.timer) {
                                this.timer = setInterval(() => {
                                    this.timeout -= 1 * ONE_MINUTE;
                                    if (this.timeout < 0) {
                                        if (DEBUG) {
                                            console.log('Session timed out');
                                        }
                                        cookies.remove(SCOPE_COOKIE);
                                        clearInterval(this.timer);
                                        this.timer = null;
                                        if (!BackendAPI.isConnected()) {
                                            this.setState({ error: true });
                                        }
                                        this.forceUpdate();
                                    } else {
                                        if (DEBUG) {
                                            console.log(
                                                'Session socket ping @ ',
                                                this.timeout
                                            );
                                        }
                                        this.checkUUID(ip, uuid, true);
                                    }
                                }, 1 * ONE_MINUTE);
                            }
                            if (!ping) {
                                let loom = match.params.loom
                                    ? decodeURIComponent(match.params.loom)
                                    : '*';
                                let page = match.params.page
                                    ? decodeURIComponent(match.params.page)
                                    : 'welcome';
                                history.replace(
                                    '/' +
                                        [
                                            uuid,
                                            encodeURIComponent(loom),
                                            encodeURIComponent(page),
                                        ].join('/')
                                );
                            }
                        }
                    }
                );
            },
            () => {
                this.setState({ error: true });
            }
        );
    }

    onMetadataChange(metadata) {
        this.setState({ metadata: metadata, loaded: true });
    }

    restoreSession(ip, uuid, permalink) {
        const { history } = this.props;
        try {
            permalink = decodeURIComponent(permalink);
            let base64 = permalink.replace(/\$/g, '/');
            let deflated = window.atob(base64);
            let settings = JSON.parse(pako.inflate(deflated, { to: 'string' }));
            BackendAPI.importObject(settings);
            console.log('Restoring session' + uuid + '...');
            BackendAPI.queryLoomFiles(uuid, () => {
                Object.keys(settings.features).map((page) => {
                    settings.features[page].map((f, i) => {
                        BackendAPI.updateFeature(
                            i,
                            f.type,
                            f.feature,
                            f.featureType,
                            f.metadata ? f.metadata.description : null,
                            page
                        );
                    });
                });
                if (settings.page && settings.loom) {
                    let permalinkRedirect = (uuid) => {
                        history.replace(
                            '/' +
                                [
                                    uuid,
                                    encodeURIComponent(settings.loom),
                                    encodeURIComponent(settings.page),
                                ].join('/')
                        );
                        BackendAPI.forceUpdate();
                    };
                    if (!uuid) {
                        this.obtainNewUUID(ip, permalinkRedirect);
                    } else {
                        permalinkRedirect(uuid);
                    }
                } else {
                    throw 'URL params are missing';
                }
            });
        } catch (ex) {
            window.location.href = '/';
        }
    }
}

App.propTypes = {
    isAppLoading: PropTypes.bool.isRequired,
    cookies: instanceOf(Cookies).isRequired,
    sessionMode: PropTypes.string.isRequired,
    sidebarIsVisible: PropTypes.bool.isRequired,
};

const app = withRouter(withCookies(App));

const mapStateToProps = (state) => {
    return state['main'];
};

const mapDispatchToProps = (dispatch) => {
    return {
        setAppLoading: (isAppLoading) => dispatch(setAppLoading(isAppLoading)),
        setUUID: (uuid) => dispatch(setUUID(uuid)),
        setSessionMode: (mode) => dispatch(setSessionMode(mode)),
        consentToCookies: () => dispatch(consentToCookies()),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(app);
