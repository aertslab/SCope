import { PropTypes, instanceOf } from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { withRouter, Route, Link } from 'react-router-dom';
import { withCookies, Cookies } from 'react-cookie';
import CookieConsent from 'react-cookie-consent';

import ReactResizeDetector from 'react-resize-detector';
import Favicon from 'react-favicon';

import {
    Sidebar,
    Header,
    Segment,
    Dimmer,
    Loader,
    Button,
    Icon,
} from 'semantic-ui-react';

import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import { BackendAPI } from './common/API';
import Welcome from './pages/Welcome';
import Dataset from './pages/Dataset';
import Gene from './pages/Gene';
import Geneset from './pages/Geneset';
import Regulon from './pages/Regulon';
import Compare from './pages/Compare';
import Tutorial from './pages/Tutorial';
import About from './pages/About';
import { FullPageNotify } from './pages/FullPageNotify';
import Alert from 'react-popup';
import 'react-popup/style.css';

import { setAppLoading, setUUID, setSessionMode } from '../redux/actions';

const pako = require('pako');
const publicIp = require('public-ip');
const timer = 60 * 1000;
const cookieName = 'SCOPE_UUID';

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
            cookiesAllowed: false,
            cookieBannerRef: React.createRef(),
        };

        BackendAPI.getORCIDStatus((active) => {
            this.setState({ orcid_active: active });
        });

        this.timeout = null;
        this.mouseClicks = 0;
    }

    removeAllCookies() {
        this.props.cookies.remove('scope_orcid_name');
        this.props.cookies.remove('scope_orcid_id');
        this.props.cookies.remove('scope_orcid_uuid');
        this.props.cookies.remove(cookieName);
    }

    acceptCookies() {
        this.props.cookies.set('CookieConsent', 'true');
        this.props.cookies.set(cookieName, this.props.match.params.uuid, {
            path: '/',
        });
        this.setState({ cookiesAllowed: true });
    }

    render() {
        const {
            metadata,
            error,
            loaded,
            sessionsLimitReached,
        } = this.state;

        const {
            isAppLoading,
            uuid,
            sessionMode,
            sidebarIsVisible,
        } = this.props;

        return (
            <div>
                <Favicon url='src/images/SCope_favicon.ico' />
                <Segment className='parentView'>
                    <Route
                        exact
                        path='/'
                        render={() => (
                            <Segment textAlign='center' className='parentView'>
                                <Segment vertical>
                                    <Header as='h1'>SCope</Header>
                                </Segment>
                                <FullPageNotify
                                    starting={isAppLoading}
                                    connected={!error}
                                    tooManyUsers={!isAppLoading && sessionsLimitReached}
                                    timeout={!isAppLoading &&
                                             this.timeout != null &&
                                             this.timeout <= 0} />
                            </Segment>
                        )}
                    />
                    <Route
                        path='/:uuid/:loom?/:page?'
                        render={({ history }) => (
                            <Segment className='parentView'>
                                <ReactResizeDetector
                                    handleHeight
                                    skipOnMount
                                    onResize={this.onResize.bind(this)}
                                />
                                <AppHeader
                                    metadata={metadata}
                                    loaded={loaded}
                                    timeout={this.timeout}
                                    cookies={this.props.cookies}
                                    cookiesAllowed={this.state.cookiesAllowed}
                                    cookieBannerRef={this.state.cookieBannerRef}
                                />
                                <Sidebar.Pushable>
                                    <AppSidebar
                                        visible={sidebarIsVisible}
                                        onMetadataChange={this.onMetadataChange.bind(
                                            this
                                        )}
                                        sessionMode={sessionMode}
                                    />
                                    <Sidebar.Pusher
                                        style={{ width: "100%" }}>
                                        <Route
                                            path='/:uuid/:loom?/welcome'
                                            component={Welcome}
                                        />
                                        <Route
                                            path='/:uuid/:loom?/dataset'
                                            component={Dataset}
                                        />
                                        <Route
                                            path='/:uuid/:loom?/gene'
                                            component={Gene}
                                        />
                                        <Route
                                            path='/:uuid/:loom?/geneset'
                                            component={Geneset}
                                        />
                                        <Route
                                            path='/:uuid/:loom?/regulon'
                                            component={Regulon}
                                        />
                                        <Route
                                            path='/:uuid/:loom?/compare'
                                            component={() => (
                                                <Compare metadata={metadata} />
                                            )}
                                        />
                                        <Route
                                            path='/:uuid/:loom?/tutorial'
                                            component={Tutorial}
                                        />
                                        <Route
                                            path='/:uuid/:loom?/about'
                                            component={About}
                                        />
                                    </Sidebar.Pusher>
                                </Sidebar.Pushable>
                                <FullPageNotify
                                    starting={isAppLoading}
                                    connected={!error}
                                    tooManyUsers={!isAppLoading && sessionsLimitReached}
                                    timeout={!isAppLoading &&
                                             this.timeout != null &&
                                             this.timeout <= 0} />
                            </Segment>
                        )}
                    />
                </Segment>
                <CookieConsent
                    ref={this.state.cookieBannerRef}
                    enableDeclineButton
                    onDecline={() => {
                        this.removeAllCookies();
                    }}
                    onAccept={(scrolling) => this.acceptCookies(scrolling)}>
                    This website uses cookies to enhance the user experience and
                    to store user information for annotation and access
                    purposes.
                </CookieConsent>
                <Alert />{' '}
                {/* Needed for react popup to function. Do not remove */}
            </div>
        );
    }

    componentDidMount() {
        if (DEBUG) console.log('App componentDidMount', this.props);
        this.parseURLParams(this.props);
        this.getUUIDFromIP(this.props);

        if (this.props.cookies.get('CookieConsent') == 'true') {
            this.setState({ cookiesAllowed: true }, () => {
                if (
                    document.head.querySelector('[name=scope-orcid]') != null &&
                    this.state.orcid_active
                ) {
                    let auth_code = document.head
                        .querySelector('[name=scope-orcid]')
                        .getAttribute('auth');
                    if (this.state.cookiesAllowed) {
                        BackendAPI.getORCID(
                            auth_code,
                            (orcid_scope_uuid, name, orcid_id) => {
                                this.props.cookies.set(
                                    'scope_orcid_uuid',
                                    orcid_scope_uuid
                                );
                                this.props.cookies.set(
                                    'scope_orcid_name',
                                    name
                                );
                                this.props.cookies.set(
                                    'scope_orcid_id',
                                    orcid_id
                                );
                                // Possibly a bit hacky, but it works to remove the code from the URL
                                location.href =
                                    location.origin +
                                    location.pathname +
                                    location.hash;
                            }
                        );
                    } else {
                        alert(
                            'You must allow cookies before you are able to log in!'
                        );
                        location.href =
                            location.origin + location.pathname + location.hash;
                    }
                }
            });
        }
        document.addEventListener('click', this.clickHandler.bind(this));
        document.addEventListener('keypress', this.clickHandler.bind(this));
    }

    clickHandler() {
        this.mouseClicks += 1;
        if (DEBUG) console.log('User click', this.mouseClicks);
    }

    componentWillUnmount() {
        if (this.timer) clearInterval(this.timer);
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
        if (DEBUG) console.log('Query params - loom: ', loom, ' page: ', page);
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
            if (match.params.uuid == 'permalink') {
                if (DEBUG) console.log('Permalink detected');
                this.restoreSession(
                    ip,
                    cookies.get(cookieName),
                    match.params.loom
                );
            } else if (match.params.uuid.startsWith('permalink')) {
                this.restoreSession(
                    ip,
                    match.params.uuid.substring(11),
                    match.params.loom
                );
            } else {
                if (DEBUG)
                    console.log('Params UUID detected:', match.params.uuid);
                this.checkUUID(ip, match.params.uuid);
                console.log(this.state.cookiesAllowed);
                console.log(cookieName, match.params.uuid, { path: '/' });
                if (this.state.cookiesAllowed) {
                    cookies.set(cookieName, match.params.uuid, { path: '/' });
                }
            }
        } else if (cookies.get(cookieName)) {
            if (DEBUG)
                console.log('Cookie UUID detected:', cookies.get(cookieName));
            this.checkUUID(ip, cookies.get(cookieName));
        } else {
            if (DEBUG) console.log('No UUID detected');
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
                if (DEBUG) console.log('getUUID', query);
                gbc.services.scope.Main.getUUID(query, (err, response) => {
                    if (DEBUG) console.log('getUUID', response);
                    if (response != null) onSuccess(response.UUID);
                });
            },
            () => {
                this.setState({ error: true });
            }
        );
    }

    checkUUID(ip, uuid, ping) {
        const { cookies, history, match } = this.props;
        if (!uuid) return;
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
                if (DEBUG) console.log('request RemainingUUIDTime', query);
                gbc.services.scope.Main.getRemainingUUIDTime(
                    query,
                    (err, response) => {
                        this.mouseClicks = 0;
                        if (DEBUG)
                            console.log('getRemainingUUIDTime', response);
                        if (response.sessionsLimitReached) {
                            this.props.setAppLoading(false);
                            this.setState({
                                sessionsLimitReached: true,
                            });
                        } else {
                            this.timeout = response
                                ? parseInt(response.timeRemaining * 1000)
                                : 0;
                            // cookies.set(cookieName, uuid, { path: '/', maxAge: this.timeout });
                            if (!ping) {
                                this.props.setAppLoading(false);
                                this.props.setUUID(uuid);
                                this.props.setSessionMode(response.sessionMode);
                                BackendAPI.setSessionMode(response.sessionMode);
                            }
                            if (!this.timer) {
                                this.timer = setInterval(() => {
                                    this.timeout -= timer;
                                    if (this.timeout < 0) {
                                        if (DEBUG)
                                            console.log('Session timed out');
                                        cookies.remove(cookieName);
                                        clearInterval(this.timer);
                                        this.timer = null;
                                        if (!BackendAPI.isConnected()) {
                                            this.setState({ error: true });
                                        }
                                        this.forceUpdate();
                                    } else {
                                        if (DEBUG)
                                            console.log(
                                                'Session socket ping @ ',
                                                this.timeout
                                            );
                                        this.checkUUID(ip, uuid, true);
                                    }
                                }, timer);
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

    onResize() {
        this.forceUpdate();
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
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(app);
