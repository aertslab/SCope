import React, { Component } from 'react';
import { connect } from 'react-redux';
import { withRouter, Link } from 'react-router-dom';
import { Icon, Label, Button, Menu, Checkbox } from 'semantic-ui-react';
import { BackendAPI } from './common/API';
import PropTypes from 'prop-types';
import { Cookies } from 'react-cookie';
import Bitly from 'bitly4api';
import pako from 'pako';

let bitly = new Bitly(BITLY.token);

import { consentToCookies } from '../redux/actions';

import { OrcidButton } from './Orcid';

const cookieName = 'SCOPE_UUID';

class AppHeader extends Component {
    static propTypes = {
        cookies: PropTypes.instanceOf(Cookies).isRequired,
        timeout: PropTypes.string.isRequired,
    };

    constructor(props) {
        super(props);
        this.state = {
            shortUrl: null,
            cookies: props.cookies,
            permalinkUUID: false,
            orcid_active: true,
        };

        BackendAPI.getORCIDStatus((active) => {
            this.setState({ orcid_active: active });
        });
    }

    acceptCookies = () => {
        this.props.cookies.set('CookieConsent', 'true');
        this.props.cookies.set(cookieName, this.props.match.params.uuid, {
            path: '/',
        });
        this.props.consentToCookies();
    };

    openORCID = () => {
        window.open(
            `https://orcid.org/oauth/authorize?client_id=${ORCID.client_id}&response_type=code&scope=/authenticate&show_login=false&redirect_uri=${ORCID.redirect_uri}`,
            '_self',
            'toolbar=no, scrollbars=yes, width=500, height=600, top=500, left=500'
        );
    };

    // TODO: Hacky implementation. To be refactored/reviewed properly
    getAllAnnotations(metadata) {
        let allAnnos = [];
        for (const clustering of metadata['cellMetaData']['clusterings']) {
            for (const cluster of clustering['clusters']) {
                if (cluster['cell_type_annotation'].length > 0) {
                    for (const anno of cluster['cell_type_annotation']) {
                        allAnnos.push({
                            clustering: clustering['name'],
                            cluster: cluster['description'],
                            anno: anno,
                        });
                    }
                }
            }
        }
        return allAnnos;
    }

    render() {
        const { match, timeout } = this.props;
        const { shortUrl } = this.state;

        let metadata = BackendAPI.getLoomMetadata(
            decodeURIComponent(match.params.loom)
        );
        let menu = this.menuList(metadata);

        let orcid_logout = () => {
            this.props.cookies.remove('scope_orcid_name');
            this.props.cookies.remove('scope_orcid_id');
            this.props.cookies.remove('scope_orcid_uuid');
        };

        return (
            <Menu stackable secondary attached='top' className='vib' inverted>
                {menu.map(
                    (item, i) =>
                        item.display && (
                            <Menu.Item key={i}>
                                <Link
                                    to={
                                        '/' +
                                        [
                                            match.params.uuid,
                                            match.params.loom,
                                            item.path,
                                        ].join('/')
                                    }>
                                    <Button
                                        basic
                                        active={
                                            match.params.page === item.path
                                        }>
                                        {item.icon && <Icon name={item.icon} />}
                                        {item.title} &nbsp;{' '}
                                        {item.path === 'geneset' && (
                                            <Label color='violet' size='mini'>
                                                beta
                                            </Label>
                                        )}
                                    </Button>
                                </Link>
                            </Menu.Item>
                        )
                )}
                <Menu.Item>
                    <Icon
                        name='linkify'
                        onClick={this.getPermalink.bind(
                            this,
                            this.state.permalinkUUID,
                            false
                        )}
                        className='pointer'
                        title='Get permalink'
                    />
                    {shortUrl && (
                        <Label className='permalink'>{shortUrl}</Label>
                    )}
                    {shortUrl && (
                        <Label>
                            <Checkbox
                                className='permalink'
                                checked={this.state.permalinkUUID}
                                onChange={this.getPermalink.bind(this, true)}
                                data-tooltip='WARNING: Anyone that uses this link will have read and write access to this session but will be able to see all loom files in this session.'
                                data-position='bottom center'
                                data-variation='tiny'
                            />
                            {'      Include session UUID in permalink?'}
                        </Label>
                    )}
                </Menu.Item>
                <Menu.Item>
                    <OrcidButton
                        acceptCookies={() => this.acceptCookies()}
                        cookieConsent={this.props.cookieConsent}
                        identifier={this.props.cookies.get('scope_orcid_id')}
                        name={this.props.cookies.get('scope_orcid_name')}
                        login={() => this.openORCID()}
                        logout={orcid_logout}
                    />
                </Menu.Item>

                <Menu.Item className='sessionInfo'>
                    Your session will be deleted {timeout} &nbsp;
                    <Icon
                        name='info circle'
                        inverted
                        title='Our servers can only store that much data. Your files will be removed after the session times out.'
                    />
                    <Button
                        data-tooltip='Start with a new session ID. Your old ID will remain until its timeout expires, please store it if you would like to return. It cannot be recovered.'
                        data-position='bottom right'
                        onClick={this.resetUUID.bind(this)}>
                        Get new session
                    </Button>
                </Menu.Item>
            </Menu>
        );
    }

    resetUUID() {
        const { history, cookies } = this.props;
        BackendAPI.getUUIDFromIP((uuid) => {
            cookies.remove(cookieName);
            if (this.props.cookieConsent) {
                cookies.set(cookieName, uuid, { path: '/' });
            }
            history.replace('/' + [uuid]);
            BackendAPI.forceUpdate();
        });
    }

    menuList(metadata) {
        return [
            {
                display: true,
                path: 'welcome',
                title: 'SCope',
                icon: 'home',
            },
            /*
			{
				display: metadata ? true : false,
				path: 'dataset',
				title: 'Dataset info',
				icon: false
			},
			*/
            {
                display: metadata ? true : false,
                path: 'gene',
                title: 'Gene',
                icon: false,
            },
            {
                display:
                    metadata && metadata.fileMetaData.hasRegulonsAUC
                        ? true
                        : false,
                path: 'regulon',
                title: 'Regulon',
                icon: false,
            },
            {
                display:
                    metadata && this.getAllAnnotations(metadata).length > 0
                        ? true
                        : false,
                path: 'annotations',
                title: 'All Annotations',
                icon: false,
            },
            {
                display: metadata ? true : false,
                path: 'compare',
                title: 'Compare',
                icon: false,
            },
            {
                display: true,
                path: 'tutorial',
                title: 'Tutorial',
                icon: false,
            },
            {
                display: true,
                path: 'about',
                title: 'About',
                icon: false,
            },
        ];
    }

    getPermalink(togglePermalinkUUID) {
        const { match } = this.props;
        if (togglePermalinkUUID) {
            let state = !this.state.permalinkUUID;
            this.state.setState({
                permalinkUUID: state,
            });
        }
        let j = JSON.stringify(
            BackendAPI.getExportObject(match.params),
            BackendAPI.getExportKeys()
        );
        let d = pako.deflate(j, { to: 'string' });
        let b = encodeURIComponent(window.btoa(d).replace(/\//g, '$'));
        const uuid =
            'permalink' +
            (this.state.permalinkUUID ? '__' + match.params.uuid : '');

        bitly
            .shorten(BITLY.baseURL + '/#/' + uuid + '/' + b)
            .then((result) => {
                this.setState({ shortUrl: result.link });
                this.forceUpdate();
            })
            .then((error) => {
                if (error) {
                    console.log(error);
                }
            });
    }
}

const appHeader = withRouter(AppHeader);

const mapStateToProps = (state) => {
    return {
        cookieConsent: state['main'].cookieConsent,
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        consentToCookies: () => dispatch(consentToCookies()),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(appHeader);
