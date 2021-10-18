import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Icon, Label, Button, Menu } from 'semantic-ui-react';

import { LegacyAPI } from '../api';

import * as Auth from './Auth';
import { SemanticICONS } from 'semantic-ui-react/dist/commonjs/generic';

export const AppHeader: React.FC<{}> = () => {
    const { uuid, loom, page } =
        useParams<{ uuid?: string; loom?: string; page?: string }>();

    // TODO: Hacky implementation. To be refactored/reviewed properly
    const countAnnotations = (metadata) => {
        let count = 0;
        for (const clustering of metadata['cellMetaData']['clusterings']) {
            for (const cluster of clustering['clusters']) {
                count += cluster['cell_type_annotation'].length;
            }
        }
        return count;
    };

    const metadata =
        loom !== undefined
            ? LegacyAPI.getLoomMetadata(decodeURIComponent(loom))
            : null;
    const menu = [
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
                metadata && metadata.fileMetaData.hasRegulonsAUC ? true : false,
            path: 'regulon',
            title: 'Regulon',
            icon: false,
        },
        {
            display: metadata && countAnnotations(metadata) > 0 ? true : false,
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

    return (
        <Menu stackable secondary attached='top' className='vib' inverted>
            {menu.map(
                (item, i) =>
                    item.display && (
                        <Menu.Item key={i}>
                            <Link to={'/' + [uuid, loom, item.path].join('/')}>
                                <Button basic active={page === item.path}>
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
