import React, { Component } from 'react'
import { Label, Segment, Icon, Popup, Image } from 'semantic-ui-react'
import FeatureSearchInput from './FeatureSearchInput';
import { BackendAPI } from './API'

export default class FeatureSearch extends React.Component {

	constructor(props) {
		super(props);
		this.state = {
			isLoading: false,
			results: [],
			value: props.value,
			selection: null,
			type: props.type
		};
		this.call = null;
	}

	render() {

		const { isLoading, value, results, type } = this.state;
		const { locked, color, options } = this.props;

		return (
			<Segment color={color} inverted className="noPadding">
				<FeatureSearchInput
					category
					loading={isLoading}
					onResultSelect={this.handleResultSelect.bind(this)}
					onSearchChange={this.handleSearchChange.bind(this)}
					handleTypeChange={this.handleTypeChange.bind(this)}
					onSelectionChange={this.handleSelectionChange.bind(this)}
					onBlur={this.handleBlur.bind(this)}
					onMouseDown={this.handleMouseDown.bind(this)}
					stopRequest={() => {
						if (this.call != null) this.call.end();
					}}
					results={results}
					options={options}
					selectFirstResult={true}
					value={value}
					type={type}
					locked={locked}
				/>
			</Segment>
		);
	}

	resetComponent() {
		this.setState({ isLoading: false, results: [], value: '', selection: null })
		BackendAPI.setActiveFeature(this.props.field, this.state.type, '', '', 0, null);
	}

	updateFeature(feature, featureType, featureDescription) {
		this.setState({ value: feature, selection: null })
		if (featureType == 'regulon') {
			let regulonQuery = {
				loomFilePath: BackendAPI.getActiveLoom(),
				regulon: feature
			}
			BackendAPI.getConnection().then((gbc) => {
				if (DEBUG) console.log('getRegulonMetaData', regulonQuery);
				gbc.services.scope.Main.getRegulonMetaData(regulonQuery, (regulonErr, regulonResponse) => {
					if (DEBUG) console.log('getRegulonMetaData', regulonResponse);
					let metadata = regulonResponse ? regulonResponse.regulonMeta : {};
					let threshold = 0;
					if (metadata.autoThresholds) {
						metadata.autoThresholds.map((t) => {
							if (t.name == metadata.defaultThreshold) threshold = t.threshold;
						})
					}
					metadata.description = featureDescription;
					BackendAPI.setActiveFeature(this.props.field, this.state.type, featureType, feature, threshold, metadata);
				});
			}, () => {
				BackendAPI.showError();	
			});
		} else if (featureType.indexOf('Clustering:') == 0) {
			let loomMetadata = BackendAPI.getActiveLoomMetadata();
			let clusteringID, clusterID;
			loomMetadata.cellMetaData.clusterings.map(clustering => {
				if (featureType.indexOf(clustering.name) != -1) {
					clusteringID = clustering.id
					clustering.clusters.map(c => {
						if (c.description == feature) {
							clusterID = c.id;
						}
					})
				}
			})
			if (clusterID != null) {
				let markerQuery = {
					loomFilePath: BackendAPI.getActiveLoom(),
					clusterID: clusterID,
					clusteringID: clusteringID, 
				}
				BackendAPI.getConnection().then((gbc) => {
					if (DEBUG) console.log('getMarkerGenes', markerQuery);
					gbc.services.scope.Main.getMarkerGenes(markerQuery, (markerErr, markerResponse) => {
						if (DEBUG) console.log('getMarkerGenes', markerResponse);
						if (!markerResponse) markerResponse = {};
						markerResponse.description = featureDescription
						BackendAPI.setActiveFeature(this.props.field, this.state.type, featureType, feature, 0, markerResponse);
					});
				}, () => {
					BackendAPI.showError();	
				});
			} else {
				setTimeout(() => {
					BackendAPI.setActiveFeature(this.props.field, this.state.type, featureType, feature, 0, {description: featureDescription});
				}, 50);
			}
		} else {
			setTimeout(() => {
				BackendAPI.setActiveFeature(this.props.field, this.state.type, featureType, feature, 0, {description: featureDescription});
			}, 50);
		}
	}


	handleMouseDown(e, { result }) {
		e.stopPropagation();
		//e.preventDefault();
	}

	handleResultSelect(e, { result }) {
		e.stopPropagation();
		e.preventDefault();
		if (DEBUG) console.log('handleResultSelect', e, result);
		this.updateFeature(result.title, result.type, result.description);
	}

	handleTypeChange(type) {
		this.setState({type: type});
	}

	handleSelectionChange(e, { result }) {
		if (DEBUG) console.log('handleSelectionChange', e, result);
		e.preventDefault();
		this.setState({selection: result})
	}

	handleBlur(e, select) {
		e.stopPropagation();		
		e.preventDefault();
		let selection = this.state.selection;
		if (selection) {
			//selection = select.results[0].results[0];
			if (DEBUG) console.log('handleBlur', e.target, e.source, selection);
			this.updateFeature(selection.title, selection.type, selection.description);
		}
	}

	handleSearchChange(e, { value }) {
		if (this.call != null) this.call.end();
		this.setState({ isLoading: true, value })
		if (this.state.value.length < 1) return this.resetComponent();
		let query = {
			loomFilePath: BackendAPI.getActiveLoom(),
			query: this.state.value
		};
		if (DEBUG) console.log("getFeatures", query);
		BackendAPI.getConnection().then((gbc) => {
			this.call = gbc.services.scope.Main.getFeatures(query, (err, response) => {
				if (DEBUG) console.log("getFeatures", response);
				if (response != null) {
					let res = [], genes = [], regulons = [], clusters = {};
					let type = this.state.type;

					for (var i = 0; i < response.feature.length; i++) {
						let f = response.feature[i];
						let ft = response.featureType[i];
						let d = response.featureDescription[i];
						if (ft == 'gene') {
							genes.push({ "title": f, "type": ft, "description": d });
						} else if (ft == 'regulon') {
							regulons.push({ "title": f, "type": ft, "description": d });
						} else if (ft.indexOf('Clustering:') == 0) {
							if (!clusters[ft]) clusters[ft] = [];
							clusters[ft].push({ "title": f, "type": ft, "description": d });
						} else if (ft.indexOf('cluster#') == 0) {
							let cid = ft.split('#')[1], name = '';
							activeMetadata.cellMetaData.clusterings.map((c, i) => {
								if (c.id == cid) {
									name = c.name;
								}
							})
							if (!clusters[ft]) clusters[ft] = {name: name, results: []};
							clusters[ft].push({ "title": f, "type": ft, "description": d });
						}
					};

					genes = {"name": "gene", "results": genes.slice(0, 10)}
					regulons = {"name": "regulon", "results": regulons.slice(0, 10)}

					if (genes['results'].length && (type == 'all' || type == 'gene')) {
						res.push(genes);
					}
					if (regulons['results'].length && (type == 'all' || type == 'regulon')) {
						res.push(regulons);
					}
					if (type == 'all' || type == 'cluster') {
						Object.keys(clusters).map((ft) => {
							res.push({"name": ft, "results": clusters[ft].slice(0, 10)})
						});
					}

					this.setState({
						isLoading: false,
						results: res,
					})

				} else {

					this.setState({
						isLoading: false,
						results: [],
					})

				}
			});
		}, () => {
			BackendAPI.showError();	
		});
	}

	componentWillReceiveProps(nextProps) {
		this.setState({ value: nextProps.value, type: nextProps.type })
	}
}
