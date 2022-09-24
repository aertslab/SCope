import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Icon, Button, Menu } from 'semantic-ui-react';
import { SemanticICONS } from 'semantic-ui-react/dist/commonjs/generic';

import * as Auth from './Auth';

export const AppHeader: React.FC<{}> = () => {
    const { pathname } = useLocation();

    const menu = [
        {
            path: '/',
            title: 'SCope',
            icon: 'home',
        },
        {
            path: '/viewer',
            title: 'Viewer',
            icon: false,
        },
        {
            path: '/regulon',
            title: 'Regulon',
            icon: false,
        },
        {
            path: '/annotations',
            title: 'All Annotations',
            icon: false,
        },
        {
            path: '/tutorial',
            title: 'Tutorial',
            icon: false,
        },
        {
            path: '/about',
            title: 'About',
            icon: false,
        },
    ];

    return (
        <Menu stackable secondary attached='top' className='vib' inverted>
            {menu.map((item, i) => (
                <Menu.Item key={i}>
                    <Link to={item.path}>
                        <Button basic active={pathname === item.path}>
                            {item.icon && (
                                <Icon name={item.icon as SemanticICONS} />
                            )}
                            {item.title}
                        </Button>
                    </Link>
                </Menu.Item>
            ))}
            <Menu.Menu position='right'>
                <Menu.Item>
                    <Auth.AuthPanel />
                </Menu.Item>
            </Menu.Menu>
        </Menu>
    );
};
