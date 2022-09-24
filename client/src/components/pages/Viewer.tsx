import React from 'react';

import Search from '../Search';
import { LayoutManager } from '../Viewer/LayoutManager';
import RightSidebar from '../RightSidebar';

export const Viewer: React.FC<{}> = () => {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1fr',
                gridTemplateRows: '70px auto',
                gap: '10px',
                height: '100%',
                padding: '0px 14px 0px 14px',
            }}>
            <Search.FeatureSearchGroup filter='all' identifier='viewer-page' />
            <LayoutManager />
            <RightSidebar
                hideFeatures={false}
                onActiveFeaturesChange={(_a, _b) => {
                    return;
                }}
                activeLegend={undefined}
                selectedAnnotations={{}}
            />
        </div>
    );
};
