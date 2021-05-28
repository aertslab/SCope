import React from 'react';
import { Grid, Tab } from 'semantic-ui-react';
import { QueryFeatureMetadata } from '../QueryFeatureMetadata';

type QueryFeatureTabProps = {
    history: any;
    activeFeature: any;
    activeFeatureIndex: number;
    activePage: any;
    activeLegend: any;
    sessionIsRW: boolean;
};

export const QueryFeatureTab: React.FC<QueryFeatureTabProps> = (props) => {
    const { activeFeature, activeFeatureIndex } = props;

    return (
        <Tab.Pane
            attached={false}
            key={activeFeatureIndex}
            className={
                'feature' + activeFeatureIndex + ' stretched marginBottom'
            }
            style={{ textAlign: 'center' }}>
            <Grid>
                <Grid.Row columns='1' centered className='viewerRow'>
                    <Grid.Column className='viewerCell'>
                        {activeFeature ? activeFeature.featureType : ''}{' '}
                        <b> {activeFeature ? activeFeature.feature : ''} </b>
                    </Grid.Column>
                </Grid.Row>
                <QueryFeatureMetadata {...props} />
            </Grid>
        </Tab.Pane>
    );
};

export default QueryFeatureTab;
