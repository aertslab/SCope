import _ from 'lodash'
import React, { Component } from 'react'
import { withRouter, Link } from 'react-router-dom';
import { Button, Grid, Menu, Icon, Dimmer, Loader } from 'semantic-ui-react'
import FeatureSearchBox from '../common/FeatureSearchBox'
import { BackendAPI } from '../common/API'
import Viewer from '../common/Viewer'
import ViewerSidebar from '../common/ViewerSidebar'
import ViewerToolbar from '../common/ViewerToolbar'
import Histogram from '../common/Histogram'
import UploadModal from '../common/UploadModal';

class Geneset extends Component {

    constructor() {
        super();
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            activeFeatures: BackendAPI.getActiveFeatures(),
            regulonMetadata: [],
            genesets: [],
            loading: true,
            loadingMessage: 'Loading genesets',
            selectedGeneset: null,
            uploadModalOpened: false,
            sidebar: BackendAPI.getSidebarVisible(),
            colors: [],
        };
        this.activeLoomListener = (loom, metadata, coordinates) => {
            this.setState({activeLoom: loom, activeCoordinates: coordinates});
        };
        this.activeFeaturesListener = (features, featureID) => {
            this.setState({activeFeatures: features});
        };
        this.sidebarVisibleListener = (state) => {
            this.setState({sidebar: state});
            this.forceUpdate();
        }
    }

    render() {
        const { match } = this.props;
        const { activeLoom, activeCoordinates, activeFeatures, colors, geneFeatures, sidebar, genesets, loading, uploadModalOpened, selectedGeneset, loadingMessage } = this.state;

        if (!activeLoom) return (
            <div>
                Select the dataset to be analyzed
            </div>
        )

        return (
            <Grid className="flexDisplay" >
                <Dimmer active={loading} inverted>
                    <Loader inverted>{loadingMessage}</Loader>
                </Dimmer>
                <Grid.Row columns="3" centered>
                    <Grid.Column width="11" stretched>
                        <Menu secondary>
						<Menu.Menu>
							<Menu.Item key="new" onClick={this.toggleUploadModal.bind(this)}>
								<Icon name="add" />
								<em>Upload new geneset</em>
							</Menu.Item>
							{genesets.map((set, i) => {
								let active = selectedGeneset == set.geneSetFilePath;
								return (
										<Menu.Item active={active} key={set.geneSetFilePath} onClick={() => {
                                            this.setState({selectedGeneset: set.geneSetFilePath});
                                        }} >
											<Icon name={active ? "selected radio" : "radio"} />
											{set.geneSetDisplayName}
										</Menu.Item>
								);
							})}
						</Menu.Menu>
                        </Menu>
                    </Grid.Column>
                    <Grid.Column width="2">
                        <Button color="orange" onClick={this.runGeneEnrichment.bind(this)} disabled={!selectedGeneset} >Run gene enrichment</Button>
                    </Grid.Column>
                    <Grid.Column width="3">&nbsp;</Grid.Column>
                </Grid.Row>
                <Grid.Row columns="4" stretched className="viewerFlex flexRow">
                    <Grid.Column width={1}>
                        <ViewerToolbar />
                    </Grid.Column>
                    <Grid.Column stretched className="flexDouble">
                        <b className="noStretch">Geneset AUC values</b>
                        <Viewer 
                            name="reg" 
                            loomFile={activeLoom} 
                            activeFeatures={activeFeatures} 
                            activeCoordinates={activeCoordinates}
                            scale={true} 
                            colors={colors}
                        />
                    </Grid.Column>
                    <Grid.Column width={3}>
                        <ViewerSidebar  onActiveFeaturesChange={(features, id) => {
                            this.setState({activeFeatures: features});
                        }} />
                    </Grid.Column>
                </Grid.Row>
				<UploadModal title="Import a geneset file" type='GeneSet' uuid={match.params.uuid} opened={uploadModalOpened} onClose={this.toggleUploadModal.bind(this)} onUploaded={this.onGenesetUploaded.bind(this)} />
            </Grid>
        );
    }

    componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
        BackendAPI.onActiveFeaturesChange('regulon', this.activeFeaturesListener);
        BackendAPI.onSidebarVisibleChange(this.sidebarVisibleListener);
        this.getGeneSets();
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeActiveFeaturesChange('regulon', this.activeFeaturesListener);
        BackendAPI.removeSidebarVisibleChange(this.sidebarVisibleListener)
    }

    onThresholdChange(idx, threshold) {
        BackendAPI.setFeatureThreshold(idx, threshold);
    }

    toggleUploadModal(event) {
		this.setState({ uploadModalOpened: !this.state.uploadModalOpened })
	}

	getGeneSets() {
		const { match } = this.props;
		let query = {
			UUID: match.params.uuid
		};
		BackendAPI.getConnection().then((gbc) => {
			if (DEBUG) console.log("getMyGeneSets", query);
			gbc.services.scope.Main.getMyGeneSets(query, (error, response) => {
				if (response !== null) {
					if (DEBUG) console.log("getMyGeneSets", response);
					this.setState({ genesets: response.myGeneSets, loading: false });
				} else {
					this.setState({ loading: false });
					console.log("No geneset files detected");
				}
			});
		}, () => {
            BackendAPI.showError();	
        });
    }
    
    runGeneEnrichment() {
        let query = {
            loomFilePath: BackendAPI.getActiveLoom(), 
            geneSetFilePath: this.state.selectedGeneset, 
            method:"AUCell"
        }
        BackendAPI.getConnection().then((gbc) => {
            this.setState({loading: true});
            if (DEBUG) console.log('doGeneSetEnrichment', query);
    	    var call = gbc.services.scope.Main.doGeneSetEnrichment(query);
	        call.on('data', (gse) => {
		        if (DEBUG) console.log('doGeneSetEnrichment data', gse);
		        if (gse.isDone) {
                    this.setState({loading: false, colors: gse.cellValues.color});
		        } else {
                    this.setState({loadingMessage: gse.progress.status});
                }
	        });
	        call.on('end', () => {
		        if (DEBUG) console.log('doGeneSetEnrichment end');
                //this.setState({loading: false});
	        });
        }, () => {
            BackendAPI.showError();	
        })
    }

    onGenesetUploaded() {
		this.getGeneSets();
		this.toggleUploadModal();
	}

}
export default withRouter(Geneset);