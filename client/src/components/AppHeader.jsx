import React, { Component } from 'react';
import { connect } from 'react-redux';
import { withRouter, Link } from 'react-router-dom';
import { Icon, Label, Button, Menu, Checkbox } from 'semantic-ui-react';
import { BackendAPI } from './common/API';
import PropTypes from 'prop-types';
import { Cookies } from 'react-cookie';

import { consentToCookies } from '../redux/actions';

import * as Auth from './Auth';

const cookieName = 'SCOPE_UUID';

class AppHeader extends Component {
    static propTypes = {
        cookies: PropTypes.instanceOf(Cookies).isRequired,
        timeout: PropTypes.string.isRequired,
    };

    constructor(props) {
        super(props);
        this.state = {
            cookies: props.cookies,
        };

    }

    acceptCookies = () => {
        this.props.cookies.set('CookieConsent', 'true');
        this.props.cookies.set(cookieName, this.props.match.params.uuid, {
            path: '/',
        });
        this.props.consentToCookies();
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
                <Menu.Menu position='right'>
                    <Menu.Item>
                        <Auth.AuthPanel/>
                    </Menu.Item>
                </Menu.Menu>
            </Menu>
        );
    }

    menuList(metadata) {
        return [
            {
                display: true,
                path: 'welcome',
                title: 'SCope',
                icon: 'home',
            },
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
