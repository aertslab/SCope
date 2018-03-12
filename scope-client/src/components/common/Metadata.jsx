import React, { Component } from 'react'
import { Button, Icon, Table, Modal, Dimmer, Loader, Dropdown } from 'semantic-ui-react'
import { BackendAPI } from '../common/API' 

export default class Metadata extends Component { 

	constructor(props) {
		super(props);
		this.state = {
			selectionId: props.selectionId,
			loading: true,
			annotation: null,
			clustering: null,
			cellIDs: null,
			metadata : null
		}
	}

	render() {
		const { selectedGenes, selectedRegulons, selectedClusters } = this.getParsedFeatures();
		const { metadata, cellIDs, loading } = this.state;
		const { selectionId } = this.props;
		let selections = BackendAPI.getViewerSelections();
		let selection = selections[selectionId];
		let loomMetadata = BackendAPI.getActiveLoomMetadata();
		let annotationOptions = [];
		let clusteringOptions = [];
		let selectedClustering = {}, selectedClusteringName = '', tableMetadata;

		if (selectionId == null) return (
			<span>&nbsp;</span>
		);

		if (loading) {
			tableMetadata = (
				<Dimmer active inverted>
					<Loader inverted>Loading</Loader>
				</Dimmer>
			);
		} else {

			loomMetadata.cellMetaData.clusterings.map(c => {
				if (c.id == this.state.clustering) {
					selectedClusteringName = c.name;
					c.clusters.map(s => {
						selectedClustering[s.id] = s.description;
					})
				}
				clusteringOptions.push({text: c.name, value: c.id});
			})

			loomMetadata.cellMetaData.annotations.map(a => {
				annotationOptions.push({text: a.name, value: a.name});
			})


			let cellMetadata = selection.points.map((p, j) => {
				let cells;
				if (metadata) {
					return (
						<Table.Row key={j} textAlign='center' >
							<Table.Cell>{cellIDs[j] ? cellIDs[j] : p}</Table.Cell>
							<Table.Cell>{metadata.geneExpression[0] ? metadata.geneExpression[0].features[j] : ''}</Table.Cell>
							<Table.Cell>{metadata.geneExpression[1] ? metadata.geneExpression[1].features[j] : ''}</Table.Cell>
							<Table.Cell>{metadata.geneExpression[2] ? metadata.geneExpression[2].features[j] : ''}</Table.Cell>
							<Table.Cell>{metadata.aucValues[0] ? metadata.aucValues[0].features[j] : ''}</Table.Cell>
							<Table.Cell>{metadata.aucValues[1] ? metadata.aucValues[1].features[j] : ''}</Table.Cell>
							<Table.Cell>{metadata.aucValues[2] ? metadata.aucValues[2].features[j] : ''}</Table.Cell>
							<Table.Cell>{metadata.annotations[0] ? metadata.annotations[0].annotations[j] : ''}</Table.Cell>
							<Table.Cell>{metadata.clusterIDs[0] ? selectedClustering[metadata.clusterIDs[0].clusters[j]] : ''}</Table.Cell>
						</Table.Row>
					);
				}
				return (
					<Table.Row key={j} textAlign='center' >
						<Table.Cell>{cellIDs[j] ? cellIDs[j] : p}</Table.Cell>
						<Table.Cell colSpan={8} /> 
					</Table.Row>
				);
			});

			tableMetadata = (
				<Table>
					<Table.Header>
						<Table.Row textAlign='center'>
							<Table.HeaderCell></Table.HeaderCell>
							<Table.HeaderCell colSpan='3'>Gene expression</Table.HeaderCell>
							<Table.HeaderCell colSpan='3'>AUC values</Table.HeaderCell>
							<Table.HeaderCell>Annotation</Table.HeaderCell>
							<Table.HeaderCell>Clustering</Table.HeaderCell>
						</Table.Row>
						<Table.Row textAlign='center'>
							<Table.HeaderCell>Cell ID</Table.HeaderCell>
							<Table.HeaderCell>{selectedGenes[0] ? selectedGenes[0] : 'none selected'}</Table.HeaderCell>
							<Table.HeaderCell>{selectedGenes[1]}</Table.HeaderCell>
							<Table.HeaderCell>{selectedGenes[2]}</Table.HeaderCell>
							<Table.HeaderCell>{selectedRegulons[0] ? selectedRegulons[0] : 'none selected'}</Table.HeaderCell>
							<Table.HeaderCell>{selectedRegulons[1]}</Table.HeaderCell>
							<Table.HeaderCell>{selectedRegulons[2]}</Table.HeaderCell>
							<Table.HeaderCell>
								<Dropdown inline placeholder='select annotation' defaultValue={this.state.annotation} options={annotationOptions} onChange={(p, s) =>{
									setTimeout(() => {
										this.setState({annotation: s.value, metadata: null, loading: true});
										this.getMetadata();
									}, 50);
								}} />
							</Table.HeaderCell>
							<Table.HeaderCell>
								<Dropdown inline placeholder='select clustering' defaultValue={this.state.clustering} options={clusteringOptions} onChange={(p, s) => {
									setTimeout(() => {
										this.setState({clustering: s.value, metadata: null, loading: true});
										this.getMetadata();
									}, 50);
								}} />
							</Table.HeaderCell>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{cellMetadata}
					</Table.Body>
				</Table>
			);
		}

		return (
			<Modal 
				open={selectionId != null ? true : false}
				onMount={() => {
					setTimeout(() => {
						this.getMetadata();	
					})					
				}}
				onClose={this.closeModal.bind(this)}
				size={'fullscreen'}
				>
				<Modal.Content image scrolling>
					{tableMetadata}
				</Modal.Content>
				<Modal.Actions>
					<Button primary onClick={() => {
							let data = [];
							selection.points.map((p,i) => {
								let cellData = {};
								cellData['cellID'] = cellIDs ? cellIDs[i] : p;
								if (metadata) {
									selectedGenes.map((g, j) => {
										cellData[g]	= metadata.geneExpression[j].features[i];
									})
									selectedRegulons.map((g, j) => {
										cellData[g]	= metadata.aucValues[j].features[i];
									})
									if (metadata.annotations[0]) cellData[this.state.annotation] = metadata.annotations[0].annotations[i];
									if (metadata.clusterIDs[0]) cellData[selectedClusteringName] = selectedClustering[metadata.clusterIDs[0].clusters[i]];
								}
								data.push(cellData);
							})
							var fileDownload = require('react-file-download');
							const json2csv  = require('json2csv').parse;
							const csv = json2csv(data);
							fileDownload(csv, 'metadata.csv');
						}}
						>
						<Icon name='download' /> Download 
					</Button>
					<Button onClick={this.closeModal.bind(this)} >
						<Icon name='close' /> Close 
					</Button>
				</Modal.Actions>
			</Modal>
		);
	}

	componentWillReceiveProps() {
		this.forceUpdate();
	}

	closeModal() {
		this.props.onClose()
		this.setState({loading: true});
	}

	getParsedFeatures() {
		let features = BackendAPI.getActiveFeatures();
		let metadata = BackendAPI.getActiveLoomMetadata();
		let selectedGenes = [];
		let selectedRegulons = [];
		let selectedClusters = [];
		features.map(f => {
			if (f.featureType == 'gene') selectedGenes.push(f.feature);
			if (f.featureType == 'regulon') selectedRegulons.push(f.feature);
			if (f.featureType.indexOf('Clustering:') == 0) {
				metadata.cellMetaData.clusterings.map( clustering => {
					if (f.featureType.indexOf(clustering.name) != -1) {
						clustering.clusters.map(c => {
							if (c.description == f.feature) {
								selectedClusters.push({clusteringName: clustering.name, clusteringID: clustering.id, clusteName: c.name, clusterID: c.id});
							}
						})
					}
				})
			}
		})
		return { selectedGenes, selectedRegulons, selectedClusters }
	}

	getMetadata() {
		let selections = BackendAPI.getViewerSelections();
		let settings = BackendAPI.getSettings();
		let loomFilePath = BackendAPI.getActiveLoom();
		let coordinates = BackendAPI.getActiveCoordinates();
		const { selectedGenes, selectedRegulons, selectedClusters } = this.getParsedFeatures();
		let query = {
			loomFilePath: loomFilePath,
			cellIndices: selections[this.props.selectionId].points,
			hasLogTransform: settings.hasLogTransform,
			hasCpmTransform: settings.hasCpmNormalization,
			selectedGenes: selectedGenes,
			selectedRegulons: selectedRegulons,
			clusterings: this.state.clustering ? [this.state.clustering] : [],
			annotations: this.state.annotation ? [this.state.annotation] : []
		}
		let queryCells = {
			loomFilePath: loomFilePath,
			cellIndices: selections[this.props.selectionId].points,
		}
		BackendAPI.getConnection().then((gbc) => {
			if (DEBUG) console.log('getCellIDs', queryCells);
			gbc.services.scope.Main.getCellIDs(queryCells, (cellsErr, cellsResponse) => {
				if (DEBUG) console.log('getCellIDs', cellsResponse);
				if (DEBUG) console.log('getCellMetaData', query);
				gbc.services.scope.Main.getCellMetaData(query, (err, response) => {
					if (DEBUG) console.log('getCellMetaData', response);
					this.setState({loading: false, metadata: response, selection: selections[this.state.selectionId], cellIDs: cellsResponse.cellIds});
				});
			});
		});
	}
}
