import _ from 'lodash'
import React, { Component } from 'react'
import { Grid, Input, Icon } from 'semantic-ui-react'
import { BackendAPI } from '../common/API' 

export default class ViewerSidebar extends Component {
    
    constructor() {
        super();
        this.state = {
            activePage: BackendAPI.getActivePage(),
            lassoSelections: BackendAPI.getViewerSelections()
        }
        this.featuresListener = (features) => {
            this.getMetadata(this.state.lassoSelections);
        }
        this.selectionsListener = (selections) => {
            this.setState({lassoSelections: selections});
            this.getMetadata(selections);
        }        
    }

    render() {

        let lassoSelections = () => {
            if(this.state.lassoSelections.length == 0) {
                return (
                    <Grid>
                        <Grid.Column>No user's lasso selections</Grid.Column>
                    </Grid>
                );
            }
            return (this.state.lassoSelections.map((lS) => {
                return (
                    <Grid key={lS.id} columns={3}>
                        <Grid.Column>
                            {"Selection "+ lS.id}
                        </Grid.Column>
                        <Grid.Column>
                            <Input
                                size='mini'
                                style={{width: 75, height: 10}}
                                label={{ style: {backgroundColor: '#'+lS.color } }}
                                labelPosition='right'
                                placeholder={'#'+lS.color}
                            />
                        </Grid.Column>
                        <Grid.Column>
                            <Icon name='eye' style={{display: 'inline'}} onClick={(e,d) => this.toggleLassoSelection(lS.id)} style={{opacity: lS.selected ? 1 : .5 }}/>
                            <Icon name='trash' style={{display: 'inline'}} onClick={(e,d) => this.removeLassoSelection(lS.id)} />
                            <Icon name='download' style={{display: 'inline'}} onClick={(e,d) => this.downloadLassoSelection(lS.id)} />
                        </Grid.Column>
                    </Grid>
                )
            }))
        }

        return lassoSelections();
    }

    componentWillMount() {
        BackendAPI.onViewerSelectionsChange(this.selectionsListener);
        BackendAPI.onActiveFeaturesChange(this.state.activePage, this.featuresListener);
    }

    componentWillUnmount() {
        BackendAPI.removeViewerSelectionsChange(this.selectionsListener);
        BackendAPI.removeActiveFeaturesChange(this.state.activePage, this.featuresListener);
    }

    toggleLassoSelection(id) {
        BackendAPI.toggleLassoSelection(id);
    }

    removeLassoSelection(id) {
        BackendAPI.removeViewerSelection(id);
    }

    getMetadata(selections) {
        let settings = BackendAPI.getSettings();
        let loomFilePath = BackendAPI.getActiveLoom();
        let coordinates = BackendAPI.getActiveCoordinates();
        let features = BackendAPI.getActiveFeatures();
        let selectedGenes = [];
        let selectedRegulons = [];
        let selectedClusters = [];
        let metadata = BackendAPI.getActiveLoomMetadata();
        features.map(f => {
            if (f.featureType == 'gene') selectedGenes.push(f.feature);
            if (f.featureType == 'regulon') selectedRegulons.push(f.feature);
            if (f.featureType.indexOf('Clustering:') == 0) {
                metadata.cellMetaData.clusterings.map( clustering => {
                    if (f.featureType.indexOf(clustering.name) != -1) {
                        clustering.clusters.map(c => {
                            if (c.description == f.feature) {
                                selectedClusters.push({clusteringID: clustering.id, clusterID: c.id});
                            }
                        })                        
                    }
                })
            }
        })
        selectedClusters.map(c => {
            let query = {
                loomFilePath: loomFilePath,
                clusteringID: c.clusteringID,
                clusterID: c.clusterID
            }
            console.log('getMarkerGenes', query);
            BackendAPI.getConnection().then((gbc) => {
                gbc.services.scope.Main.getMarkerGenes(query, (err, response) => {
                    console.log('getMarkerGenes', response);
                });
            });
        })
        selections.map(s => {
            let query = {
                loomFilePath: loomFilePath,
                cellIndices: s.points,
                hasLogTranform: settings.hasLogTransform,
                hasCpmTranform: settings.hasCpmNormalization,
                selectedGenes: selectedGenes,    // List of genes to return epxression values for
                selectedRegulons: selectedRegulons, // As above, for regulons and AUC values
                clusterings: [], // IDs of clustering values to return per cell
                annotations: []  // String name of annotations to return (from global metadata)
            }
            console.log('getCellMetaData', query);
            BackendAPI.getConnection().then((gbc) => {
                gbc.services.scope.Main.getCellMetaData(query, (err, response) => {
                    console.log('getCellMetaData', response);
                });
            });
        });
    }

}
