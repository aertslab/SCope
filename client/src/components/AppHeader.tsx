import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Icon, Label, Button, Menu } from 'semantic-ui-react';

import { LegacyAPI } from '../api';

import * as Auth from './Auth';
import { SemanticICONS } from 'semantic-ui-react/dist/commonjs/generic';

export const AppHeader: React.FC<{}> = () => {
    const { pathname } = useLocation();
    const loom = '*';

    const metadata =
        loom !== undefined ? LegacyAPI.getLoomMetadata(loom) : null;

    const menu = [
        {
            display: true,
            path: '/welcome',
            title: 'SCope',
            icon: 'home',
        },
        {
            display: metadata ? true : false,
            path: '/gene',
            title: 'Gene',
            icon: false,
        },
        {
            display:
                metadata && metadata.fileMetaData.hasRegulonsAUC ? true : false,
            path: '/regulon',
            title: 'Regulon',
            icon: false,
        },
        {
            display: metadata ? true : false,
            path: '/annotations',
            title: 'All Annotations',
            icon: false,
        },
        {
            display: metadata ? true : false,
            path: '/compare',
            title: 'Compare',
            icon: false,
        },
        {
            display: true,
            path: '/viewer',
            title: 'Viewer',
            icon: false,
        },
        {
            display: true,
            path: '/tutorial',
            title: 'Tutorial',
            icon: false,
        },
        {
            display: true,
            path: '/about',
            title: 'About',
            icon: false,
        },
    ];

    return (
        <Menu stackable secondary attached='top' className='vib' inverted>
            {menu.map(
                (item, i) =>
                    item.display && (
                        <Menu.Item key={i}>
                            <Link to={item.path}>
                                <Button basic active={pathname === item.path}>
                                    {item.icon && (
                                        <Icon
                                            name={item.icon as SemanticICONS}
                                        />
                                    )}
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
                    <Auth.AuthPanel />
                </Menu.Item>
            </Menu.Menu>
        </Menu>
    );
};
