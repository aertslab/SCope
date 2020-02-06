import _ from 'lodash'
import React, { Component, createRef } from 'react'
import { withRouter } from 'react-router-dom';
import { Container, Grid, Input, Icon, Tab, Image, Button, Progress } from 'semantic-ui-react'
import { BackendAPI } from '../common/API'
import Metadata from '../common/Metadata'
import ReactGA from 'react-ga';
import Popup from 'react-popup'

import ReactTable from "react-table";
import "react-table/react-table.css";
import FileDownloader from '../../js/http'

import CollaborativeAnnotation from  './CollaborativeAnnotation'

import { delimiter } from 'path';

class ViewerSidebar extends Component {

	constructor() {
		super();
		this.state = {
			activePage: BackendAPI.getActivePage(),
			activeLoom: BackendAPI.getActiveLoom(),
			activeFeatures: BackendAPI.getActiveFeatures(),
			lassoSelections: BackendAPI.getViewerSelections(),
			modalID: null,
			newAnnoName: "",
			newAnnoRef: createRef(),
			activeTab: 0,
			processSubLoomPercentage: null,
			downloadSubLoomPercentage: null,
			imageErrored: false
		};
		this.selectionsListener = (selections) => {
			this.setState({lassoSelections: selections, activeTab: 0});
		};
		this.activeFeaturesListener = (features, id) => {
			this.props.onActiveFeaturesChange(features, id);
			this.setState({activeFeatures: features, activeTab: parseInt(id) + 1});
		};
		this.setNewAnnotationName.bind(this)
		this.onNewAnnotationChange.bind(this)
	}

	onNewAnnotationChange = (e) => {
		this.setNewAnnotationName(e.target.value)
	}

	setNewAnnotationName = (newAnnoName) => {
		this.setState({newAnnoName: newAnnoName})
	}

	render() {
		const { history, match, hideFeatures } = this.props;
		const { lassoSelections, activeFeatures, activeTab, activePage } = this.state;
		
		let lassoTab = () => {
			if (lassoSelections.length == 0) {
				return (
					<Tab.Pane attached={false} style={{'textAlign': 'center'}} >
						<br /><br />
						No user's lasso selections
						<br /><br /><br />
					</Tab.Pane>
				);
			}

			return (lassoSelections.map((lS, i) => {
				return (
					<Tab.Pane attached={false} style={{'textAlign': 'center'}} key={i}>
					<Grid>
					<Grid.Row columns={3} key={i} className="selectionRow">
						<Grid.Column>
							{"Selection "+ (lS.id + 1)}
						</Grid.Column>
						<Grid.Column>
							<Input
								size='mini'
								style={{width: 75, height: 15}}
								label={{ style: {backgroundColor: '#'+lS.color } }}
								labelPosition='right'
								placeholder={'#'+lS.color}
								disabled
							/>
						</Grid.Column>
						<Grid.Column>
							<Icon name='eye' title='toggle show/hide selection' style={{display: 'inline'}} onClick={(e,d) => this.toggleLassoSelection(lS.id)} style={{opacity: lS.selected ? 1 : .5 }} className="pointer" />
							&nbsp;
							<Icon name='trash' title='remove this selection' style={{display: 'inline'}} onClick={(e,d) => this.removeLassoSelection(i)} className="pointer"  />
							&nbsp;
							<Icon name='search' title='show metadata for this selection' style={{display: 'inline'}} onClick={(e,d) => {
								this.setState({modalID: i});
								this.forceUpdate();
								ReactGA.event({
									category: 'metadata',
									action: 'modal opened',
									value: i
								});
							}} className="pointer"  />
						</Grid.Column>
					</Grid.Row>
					</Grid>
					<br />
					</Tab.Pane>
				)
			}))
		}

		let featureTab = (i) => {

			let colors = ["red", "green", "blue"]
			let metadata = activeFeatures[i] && activeFeatures[i].feature ? "" : <div>No additional information shown for the feature queried in the <b style={{color: colors[i]}}>{colors[i]}</b> query box because it is empty. Additional information (e.g.: cluster markers, regulon motif, regulon target genes, ...) can be displayed here when querying clusters or regulons.<br/><br/></div>;
			console.log(activeFeatures[i])
			if (activeFeatures[i] && activeFeatures[i].metadata) {
				let md = activeFeatures[i].metadata
				if (md.motifName != 'NA.png' && !this.state.imageErrored) {
					if (this.state.imageErrored) {
						var image = md.motifName ? (<img src={'http://motifcollections.aertslab.org/v8/logos/'+md.motifName}/>) : '';
						this.setState({imageErrored: true});
					} else { 
						var image = md.motifName ? (<img src={'http://motifcollections.aertslab.org/v9/logos/'+md.motifName}/>) : '';
					}
				} else {
					var image = '';
				}

				this.handleAnnoUpdate = (feature, i) => {
					if (this.state.newAnnoName != '') {
						Popup.create({
							title: "BETA: Annotation Change!",
							content: <p>{["You are about to ", 
										  <b>permanently</b>, 
										  " update the annotation of the existing cluster: ", 
										  <br />, 
										  <b>{feature.feature}</b>, 
										  <br />, 
										  "to the following: ", 
										  <br />, 
										  <b>{this.state.newAnnoName}</ b>,
										  <br />,
										  <br />,
										  <b> BETA: Some SCope functionality may be imparied until the loom is reloaded</b>,
									      ]}</p>,
							buttons: {
								left: [{
									text: 'Cancel',
									className: 'danger',
									action: function () {
										Popup.close()
									}
								}],
								right: [{
									text: 'Save new annotation',
									className: 'success',
									action: () => {
										BackendAPI.setAnnotationName(feature, this.state.newAnnoName, i, this.props.match.params.uuid)
										Popup.close()
									},
									}]

							}
						});
					}
					if (this.state.newAnnoName === '') {
						Popup.alert('You must enter a new annotation')
					}
				}


				let annotationBox = () => {
					if(activeFeatures[i].featureType.startsWith("Cluster") && activeFeatures[i].feature != 'All Clusters' && BackendAPI.getLoomRWStatus() == "rw" && this.state.activePage == "gene") {					
					return (
						<Input
							ref={this.state.newAnnoRef}
							style={{"margin-bottom": "15px", width: "100%"}}
							placeholder={activeFeatures[i].feature}
							onChange={this.onNewAnnotationChange}
							actionPosition="left"
							action={{
								onClick: () => {this.handleAnnoUpdate(activeFeatures[i], i);} ,
								"data-tooltip": "PERMANENT CHANGE and forces refresh!",
								"data-variation":"basic",
								"data-position":"left center",
								content: "Update Annotation"
							}}
							value={this.state.newAnnoName}
							/>
					)}}
				
				let collabAnnoButton = () => {
					if(activeFeatures[i].featureType.startsWith("Cluster") && activeFeatures[i].feature != 'All Clusters' && BackendAPI.getLoomRWStatus() == "rw" && this.state.activePage == "gene") {					
						return (
							<CollaborativeAnnotation feature={activeFeatures[i]}/>
						)
					}
				}

				let markerTable = "", legendTable = "", cellTypeAnnoTable = "", downloadSubLoomButton = () => "";

				let newMarkerTableColumn = (header, id, accessor, cell) => {
					let column = {
						Header: header,
						id: id,
					}
					if(accessor != null) {
						column["accessor"] = d => d[accessor]
					}
					if(cell != null) {
						column["Cell"] = props => cell(props)
					}
					return column
				}

				let newCellTypeAnnoColumn = (header, id, accessor, cell) => {
					let column = {
						Header: header,
						id: id,
						style:  { 'white-space': 'normal' }
					}
					if(accessor != null) {
						column["accessor"] = d => d[accessor]
					}
					if(cell != null) {
						column["Cell"] = props => cell(props)
					}
					return column
				}

				if (md.cellTypeAnno) {
					if (md.cellTypeAnno.length > 0){ 
						let newCellTypeAnnoTableOboCell = (props) => {
							return (<a href={props.value.ols_iri} target="_blank">{props.value.obo_id}<br/>({props.value.ontology_label})</a>)
						}

						let newCellTypeAnnoTableCuratorCell = (props) => {
							console.log(props.value.validated)
							return (
								<div>
									<a href={"https://orcid.org/" + props.value.curator_id} target="_blank">{props.value.curator_name}&nbsp;</a>
									<Icon
										name={props.value.validated ? "check circle outline" : "check circle outline"}
										color={props.value.validated ? "green" : "red"}
									/>			
								</div>
							)
						}

						let newCellTypeAnnoTableVotesCell = (props) => {
							return (
								<React.Fragment>
										<Button 
										className="vote-tooltip"
										data-tooltip={props.value.votes_for.voters.map(v => v.voter_name).join(', ')}
										data-variation="basic"
										data-position="left center">
										<Icon name="thumbs up outline"/>
										{props.value.votes_for.total}</Button>
										<br/>
										<br/>
										<Button 
										className="vote-tooltip"
										data-tooltip={props.value.votes_against.length > 0 ? props.value.votes_against.voters.map(v => v.voter_name).join(', ') : "None"}
										data-variation="basic"
										data-position="left center">
										<Icon name="thumbs down outline"/>
										{props.value.votes_against.total}</Button>
								</React.Fragment>	
							)
						}

						let cellTypeAnnoColumns = [
							newCellTypeAnnoColumn("Ontology Term", "obo_id", "obo_id", newCellTypeAnnoTableOboCell),
							newCellTypeAnnoColumn("Curator", "orcid_info", "orcid_info", newCellTypeAnnoTableCuratorCell),
							newCellTypeAnnoColumn("Endorsements", "votes", "votes", newCellTypeAnnoTableVotesCell)
						]

						let cellTypeAnnoTableData = md.cellTypeAnno.map( (a, n) => {
							let cellTypeAnnoTableRowData = {
								obo_id: a.data,
								orcid_info: {curator_name: a.data.curator_name, curator_id: a.data.curator_id, validated: a.validate_hash},
								votes: {votes_for: a.votes_for, votes_against: a.votes_against}
							}
							return (cellTypeAnnoTableRowData)
						})

						let cellTypeAnnoTableHeight = screen.availHeight / 4

						let cellTypeAnnoTableHeaderName = "Community Annotations"

						cellTypeAnnoTable = (
							<div style={{marginBottom: "15px", align: "center"}}>
								<ReactTable
									data={cellTypeAnnoTableData}
									columns={[
										{
										Header: cellTypeAnnoTableHeaderName,
										columns: cellTypeAnnoColumns
										}
									]}
									pageSizeOptions={[5]}
									defaultPageSize={5}
									style={{
										height: cellTypeAnnoTableHeight +"px" // This will force the table body to overflow and scroll, since there is not enough room
									}}
									className="-striped -highlight"
								/>
							</div>
						);
					}

				}

				if (md.genes) {
					let newMarkerTableGeneCell = (props) => {
						return (
							<a className="pointer"
								onClick={() => {
									let query = {
										loomFilePath: BackendAPI.getActiveLoom(),
										query: props.value
									};
									if (activePage == 'regulon') {
										this.setState({currentPage: 'gene'});
										BackendAPI.setActivePage('gene');
										history.push('/' + [match.params.uuid, match.params.loom ? match.params.loom : '*', 'gene' ].join('/'));
									}											
									BackendAPI.getConnection().then((gbc) => {
										gbc.services.scope.Main.getFeatures(query, (err, response) => {
										BackendAPI.setActiveFeature(i, activeFeatures[i].type, "gene", props.value, 0, {description: response.featureDescription[0]});
									});
									}, () => {
										BackendAPI.showError();	
									})
									ReactGA.event({
										category: 'action',
										action: 'gene clicked',
										label: props.value,
										value: i
									});
								}}>{props.value}
							</a>
						)
					}

					// Define the marker table columns
					// Add at least the gene column
					let markerTableColumns = [
						newMarkerTableColumn("Gene Symbol", "gene", "gene", newMarkerTableGeneCell)
					]

					if ('metrics' in md) {
						// Add extra columns (metrics like logFC, p-value, ...)
						for(let metric of md.metrics) {
							markerTableColumns = [...markerTableColumns
												, newMarkerTableColumn(metric.name, metric.accessor, metric.accessor, null)
							]
						}
					}

					let markerTableData = md.genes.map( (g, j) => {
						let markerTableRowData = { gene: g }
						if (!('metrics' in md))
							return markerTableRowData
						for(let metric of md.metrics)
							markerTableRowData[metric.accessor] = metric.values[j]
						return (markerTableRowData)
					});

					let markerTableHeight = screen.availHeight/2.5

					let markerTableHeaderName = () => {
						if(activeFeatures[i].featureType == "regulon")
							return "Regulon Genes"
						else if(activeFeatures[i].featureType.startsWith("Clustering"))
							return "Cluster Markers"

					}, downloadButtonName = () => {
						if(activeFeatures[i].featureType == "regulon")
							return "Download "+ activeFeatures[i].feature +" regulon genes"
						else if(activeFeatures[i].featureType.startsWith("Clustering"))
							return "Download "+ activeFeatures[i].feature +" markers"
					}, genesFileName = () => {
						if(activeFeatures[i].featureType == "regulon")
							return activeFeatures[i].feature +"_regulon_genes.tsv"
						else if(activeFeatures[i].featureType.startsWith("Clustering"))
							return activeFeatures[i].feature +"_markers.tsv"
					};
		
					markerTable = (
						<div style={{marginBottom: "15px", align: "center"}}>
							<ReactTable
								data={markerTableData}
								columns={[
									{
									Header: markerTableHeaderName(),
									columns: markerTableColumns
									}
								]}
								pageSizeOptions={[5, 10, md.genes.length]}
								defaultPageSize={md.genes.length}
								style={{
									height: markerTableHeight +"px" // This will force the table body to overflow and scroll, since there is not enough room
								}}
								className="-striped -highlight"
							/>
							<Button primary onClick={() => {
								const opts = { delimiter: "\t", quote: '' };
								var fileDownload = require('react-file-download');
								const json2csv  = require('json2csv').parse;
								const tsv = json2csv(markerTableData, opts);
								fileDownload(tsv, genesFileName());
							}} style={{marginTop: "10px", width: "100%"}}>
							{downloadButtonName()}
							</Button>
						</div>
					);
				}

				if(this.props.activeLegend != null & activeFeatures[i].featureType == "annotation") {
					let aL = this.props.activeLegend
					let legendTableData = aL.values.map( (v, j) => ({ value: v, color: aL.colors[j] }) )
					let newLegendTableColorCell = (props) => {
						let colorLegendStyle = {
							"width": "25px",
							"height": "25px",
							"-webkit-mask-box-image": "url('src/images/dot.png')",
							"backgroundColor": "#"+ props.value
						}
						return (
							<div style={colorLegendStyle}></div>
						)
					}
					let legendTableColumns = [newMarkerTableColumn("Value", "value", "value", null)
										 	, newMarkerTableColumn("Color", "color", "color", newLegendTableColorCell)]
					legendTable = (
						<div style={{marginBottom: "15px"}}>
							<ReactTable
								data={legendTableData}
								columns={[
									{
									Header: "Legend",
									columns: legendTableColumns
									}
								]}
								pageSizeOptions={[5, 10, 20]}
								defaultPageSize={10}
								className="-striped -highlight"
								/>
						</div>
					);
				}

				if(activeFeatures[i].featureType.startsWith("Clustering")) {
					downloadSubLoomButton = () => {
						if(this.state.downloadSubLoomPercentage == null && this.state.processSubLoomPercentage ==null)
							return (
								<Button color="green" onClick={() => {
									let query = {
										loomFilePath: BackendAPI.getActiveLoom(),
										featureType: "clusterings",
										featureName: activeFeatures[i].featureType.replace(/Clustering: /g, ""),
										featureValue: activeFeatures[i].feature, 
										operator: "=="
									};											
									BackendAPI.getConnection().then((gbc) => {
										if (DEBUG) console.log("Download subset of active .loom")
										var call = gbc.services.scope.Main.downloadSubLoom(query);
										call.on('data', (dsl) => {
											if (DEBUG) console.log('downloadSubLoom data');
											if(dsl == null) {
												this.setState({ loomDownloading: null, downloadSubLoomPercentage: null });
												return
											}
											if (!dsl.isDone) {
												this.setState({ processSubLoomPercentage: Math.round(dsl.progress.value*100) });
											} else {
												// Start downloading the subsetted loom file
												let fd = new FileDownloader(dsl.loomFilePath, match.params.uuid, dsl.loomFileSize)
												fd.on('started', (isStarted) => {
													this.setState({ processSubLoomPercentage: null, loomDownloading: encodeURIComponent(dsl.loomFilePath) });
												})
												fd.on('progress', (progress) => {
													this.setState({ downloadSubLoomPercentage: progress })
												})
												fd.on('finished', (finished) => {
													this.setState({ loomDownloading: null, downloadSubLoomPercentage: null });
												})
												fd.start()
											}
										});
										call.on('end', () => {
											console.log()
											if (DEBUG) console.log('downloadSubLoom end');
										});
									}, () => {
										this.setState({ loomDownloading: null, downloadSubLoomPercentage: null, processSubLoomPercentage: null });
										BackendAPI.showError();	
									})
								}} style={{marginTop: "10px", width: "100%"}}>
								{"Download "+ activeFeatures[i].feature +" .loom file"}
								</Button>
							)
						if(this.state.processSubLoomPercentage > 0)
							return (
								<Progress percent={this.state.processSubLoomPercentage} indicating progress disabled size='large'>Processing...</Progress>
							)	
						if(this.state.downloadSubLoomPercentage > 0)
							return (
								<Progress percent={this.state.downloadSubLoomPercentage} indicating progress disabled size='large'>Downloading...</Progress>
							)
					}
				}

				metadata = (
					<Grid.Row columns="1" centered className='viewerRow'>
						<Grid.Column stretched className='viewerCell'>
							{md.featureType} {md.feature}<br />
							{image}
							{annotationBox()}
							{cellTypeAnnoTable}
							{collabAnnoButton()}
							{markerTable}
							{legendTable}
							{downloadSubLoomButton()}
							<br />
						</Grid.Column>
					</Grid.Row>
				);
			}

			return (
				<Tab.Pane attached={false} key={i} className={'feature'+ i + ' stretched marginBottom'} style={{textAlign: 'center'}}>
					<Grid>
						<Grid.Row columns="1" centered className='viewerRow'>
							<Grid.Column className='viewerCell'>
								{activeFeatures[i] ? activeFeatures[i].featureType : ''} <b> {activeFeatures[i] ? activeFeatures[i].feature : ''} </b>
							</Grid.Column>
						</Grid.Row>
						{metadata}
					</Grid>
				</Tab.Pane>
			)
		}

		let panes = [
			{ menuItem: 'Cell selections', render: lassoTab },
		]
		if (!hideFeatures) {
			_.times(3, i => {
					panes.push({
						menuItem: activeFeatures[i] && activeFeatures[i].feature ? ("F"+(i+1)+": " + activeFeatures[i].feature) : "F"+(i+1),
						render: () => featureTab(i),
					})
			})
		}
		
		let annotations = {}
		if (this.props.getSelectedAnnotations) {
			annotations = this.props.getSelectedAnnotations();
		}

		return (
			<div className="flexDisplay">
				<Tab
					menu={{ secondary: true, pointing: true }}
					panes={panes}
					renderActiveOnly={true}
					activeIndex={activeTab}
					className="sidebarTabs"
					onTabChange={(evt, data) => {
						this.setState({activeTab: data.activeIndex});
					}}
				/>
				<Metadata 
					selectionId={this.state.modalID} 
					onClose={() =>{
						ReactGA.event({
							category: 'metadata',
							action: 'modal closed',
							value: this.state.modalID,
						});
						this.setState({modalID: null});
						this.forceUpdate();
					}}
					annotations={Object.keys(annotations)}
				/>
			</div>
		);
	}

	componentWillMount() {
		this.timer = null;
		BackendAPI.onViewerSelectionsChange(this.selectionsListener);
		BackendAPI.onActiveFeaturesChange(this.state.activePage, this.activeFeaturesListener);
	}

	componentWillUnmount() {
		BackendAPI.removeViewerSelectionsChange(this.selectionsListener);
		BackendAPI.removeActiveFeaturesChange(this.state.activePage, this.activeFeaturesListener);
	}

	toggleLassoSelection(id) {
		let selected = BackendAPI.toggleLassoSelection(id);
		ReactGA.event({
			category: 'viewer',
			action: 'selection toggled',
			label: selected ? 'on' : 'off',
			value: id
		});
	}

	removeLassoSelection(id) {
		BackendAPI.removeViewerSelection(id);
		ReactGA.event({
			category: 'viewer',
			action: 'selection removed',
			value: id
		});
	}
	
}
export default withRouter(ViewerSidebar);