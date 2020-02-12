import _ from 'lodash'
import React, { Component, createRef } from 'react'
import { withRouter } from 'react-router-dom';
import { Header, Grid, Input, Icon, Tab, Label, Button, Progress, Popup } from 'semantic-ui-react'
import { BackendAPI } from '../common/API'
import Metadata from '../common/Metadata'
import ReactGA from 'react-ga';
import {Popup as RPopup} from 'react-popup'

import ReactTable from "react-table";
import "react-table/react-table.css";
import FileDownloader from '../../js/http'
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';


import CollaborativeAnnotation from  './CollaborativeAnnotation'

import { delimiter } from 'path';
import { min } from 'moment';

class ViewerSidebar extends Component {

    static propTypes = {
		cookies: instanceOf(Cookies).isRequired
	}

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

	gotoNextCluster = (i) => {
		BackendAPI.getNextCluster(this.state.activeFeatures[i].metadata['clusteringID'], this.state.activeFeatures[i].metadata['clusterID'], (response) => {
			BackendAPI.updateFeature(i, response.featureType[0], response.feature[0], response.featureType[0], response.featureDescription[0], this.props.match.params.page, (e) => {
			})
		})
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
						RPopup.create({
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
										RPopup.close()
									}
								}],
								right: [{
									text: 'Save new annotation',
									className: 'success',
									action: () => {
										BackendAPI.setAnnotationName(feature, this.state.newAnnoName, i, this.props.match.params.uuid)
										RPopup.close()
									},
									}]

							}
						});
					}
					if (this.state.newAnnoName === '') {
						RPopup.alert('You must enter a new annotation')
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
								content: "Update Description"
							}}
							value={this.state.newAnnoName}
							/>
					)}}
				
				let collabAnnoButton = () => {
					if(activeFeatures[i].featureType.startsWith("Cluster") && activeFeatures[i].feature != 'All Clusters' && BackendAPI.getLoomRWStatus() == "rw" && this.state.activePage == "gene") {					
						return (
							<Grid>
								<Grid.Row>
									<CollaborativeAnnotation feature={activeFeatures[i]} id={i}/>
									<Button onClick={() => this.gotoNextCluster(i)} className='next-cluster-button'>Next Cluster{<Icon name="long arrow alternate right"/>}</Button>
								</Grid.Row>	
							</Grid>					
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

							let popupInfo = (
								<div>
									<Header as='h3'>Evidence provided for:&nbsp;<a href={props.value.ols_iri} target="_blank">{props.value.annotation_label}<br/>{props.value.obo_id ? "(" + props.value.obo_id +")" : ""}</a></Header>
									<Header as='h4'>Markers</Header>
									{props.value.markers.length > 0 ? props.value.markers.map(m => m).join(', ') : "None provided"}
									<Header as='h4'>Publication</Header>
									{props.value.publication ? <a href={props.value.publication}>{props.value.publication}</a> : "None provided"}
									<Header as='h4'>Comment</Header>
									{props.value.comment ? props.value.publication : "None provided"}
								</div>
							)

							return (
							<div style={{textAlign: "center"}}>
							<a href={props.value.ols_iri} target="_blank">{props.value.annotation_label}<br/>{props.value.obo_id ? "(" + props.value.obo_id +")" : ""}</a>
							<br/>
							<Popup 
								trigger={<Label><Icon name="question circle" />More Info</Label> } 
								content={popupInfo}
								on="click"
							/>
							</div>
							)
						}

						let newCellTypeAnnoTableCuratorCell = (props) => {

							// Match 4 sets of 4 digits, hyphen seperated with an X as a possible final check digit
							let orcidIDRegex = /(?:\d{4}-){3}\d{3}[0-9,X]/; 

							let iconName, iconColor, popupText = ''

							if (props.value.validated & orcidIDRegex.test(props.value.curator_id)) {
								iconName = 'check circle outline'
								iconColor = 'green'
								popupText = "This annotation was generated on this site."
							} else if (orcidIDRegex.test(props.value.curator_id)) {
								iconName = 'times circle outline'
								iconColor = 'red'
								popupText = "This annotation was NOT generated on this site."
							} else {
								iconName = 'laptop'
								iconColor = 'orange'
								popupText = "This annotation is not linked to an ORCID iD and is therefore likely a prediction from a tool."
							}

							return (
								<div style={{textAlign: "center"}}>
									{orcidIDRegex.test(props.value.curator_id) ?
									<a href={"https://orcid.org/" + props.value.curator_id} target="_blank">{props.value.curator_name}&nbsp;</a>
									: props.value.curator_name + (props.value.curator_id ? "(" + props.value.curator_id + ")" : "")
									}

									<Popup 
									trigger={
										<Icon
											name={iconName}
											color={iconColor}
										/>}	
									content={popupText}
									/>		
								</div>
							)
						}

						let submitVote = (annoData, direction) => {
							BackendAPI.voteAnnotation(
								direction, 
								annoData, 
								activeFeatures[i],
								{
									orcidName: this.state.orcid_name,
									orcidID: this.state.orcid_id,
									orcidUUID: this.state.orcid_uuid
								},
								match.params.uuid,
								(response) => console.log(response)
							)
						}

						let newCellTypeAnnoTableVotesCell = (props) => {
							return (
								<React.Fragment>
										<Popup className="vote-tooltip" 
										trigger={<Button onClick={() => submitVote(props.value.data, 'for')} icon ="thumbs up outline" content={props.value.votes_for.total}/>}
										content={props.value.votes_for.voters.length > 0 ? props.value.votes_for.voters.map((v, i) => <font color={v.voter_hash ? "green" : "red"}>{"" + v.voter_name}&nbsp;&nbsp;</font>) : "None"}
										/>
										<Popup className="vote-tooltip" 
										trigger={<Button onClick={() => submitVote(props.value.data, 'against')} icon ="thumbs down outline" content={props.value.votes_against.total}/>}
										content={props.value.votes_against.voters.length > 0 ? props.value.votes_against.voters.map(v => <font color={v.voter_hash ? "green" : "red"}>{v.voter_name}&nbsp;&nbsp;</font>) : "None"}
										/>
								</React.Fragment>	
							)
						}

						let cellTypeAnnoColumns = [
							newCellTypeAnnoColumn(<div><nobr>Annotation/Ontology</nobr><p>Term</p></div>, "annotation", "annotation", newCellTypeAnnoTableOboCell),
							newCellTypeAnnoColumn("Curator", "orcid_info", "orcid_info", newCellTypeAnnoTableCuratorCell),
							newCellTypeAnnoColumn("Endorsements", "votes", "votes", newCellTypeAnnoTableVotesCell)
						]

						let cellTypeAnnoTableData = md.cellTypeAnno.map( (a, n) => {
							let cellTypeAnnoTableRowData = {
								annotation: a.data,
								orcid_info: {curator_name: a.data.curator_name, curator_id: a.data.curator_id, validated: a.validate_hash},
								votes: {
									votes_for: a.votes_for, 
									votes_against: a.votes_against, 
									data: a.data
								}
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
									pageSizeOptions={[Math.min(5, Math.max(3, md.cellTypeAnno.length))]}
									defaultPageSize={Math.min(5, Math.max(3, md.cellTypeAnno.length))}
									// style={{
									// 	height: cellTypeAnnoTableHeight +"px" // This will force the table body to overflow and scroll, since there is not enough room
									// }}
									className="-striped -highlight"
								/>
							</div>
						);
					} else {
						cellTypeAnnoTable = (
							<div style={{marginBottom: "5px", align: "center"}}>
								▼ No annotations currently exist. {BackendAPI.getLoomRWStatus() == "rw" ? "Be the first to contribute!" : ""}
							</div>
						)
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
		let orcid_name = this.props.cookies.get("scope_orcid_name")
        let orcid_id = this.props.cookies.get("scope_orcid_id")
        let orcid_uuid = this.props.cookies.get("scope_orcid_uuid")

        this.setState({
            orcid_name: orcid_name,
            orcid_id: orcid_id,
            orcid_uuid: orcid_uuid,
        })
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
export default withCookies(withRouter(ViewerSidebar));