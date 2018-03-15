import _ from 'lodash'
import React, { Component } from 'react'
import { Grid, Input, Icon, Tab, Image } from 'semantic-ui-react'
import { BackendAPI } from '../common/API'
import Metadata from '../common/Metadata'

export default class ViewerSidebar extends Component {

	constructor() {
		super();
		this.state = {
			activePage: BackendAPI.getActivePage(),
			activeFeatures: BackendAPI.getActiveFeatures(),
			lassoSelections: BackendAPI.getViewerSelections(),
			modalID: null,
			activeTab: 0
		};
		this.selectionsListener = (selections) => {
			this.setState({lassoSelections: selections, activeTab: 0});
		};
		this.activeFeaturesListener = (features, id) => {
			this.props.onActiveFeaturesChange(features, id);
			this.setState({activeFeatures: features, activeTab: parseInt(id) + 1});
		};
	}

	render() {
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
								style={{width: 75, height: 10}}
								label={{ style: {backgroundColor: '#'+lS.color } }}
								labelPosition='right'
								placeholder={'#'+lS.color}
							/>
						</Grid.Column>
						<Grid.Column>
							<Icon name='eye' title='toggle show/hide selection' style={{display: 'inline'}} onClick={(e,d) => this.toggleLassoSelection(lS.id)} style={{opacity: lS.selected ? 1 : .5 }} className="pointer" />
							&nbsp;
							<Icon name='trash' title='remove this selection' style={{display: 'inline'}} onClick={(e,d) => this.removeLassoSelection(lS.id)} className="pointer"  />
							&nbsp;
							<Icon name='search' title='show metadata for this selection' style={{display: 'inline'}} disabled={activePage == 'dndcompare'} onClick={(e,d) => {
								if (activePage != 'dndcompare') {
									this.setState({modalID: i});
									this.forceUpdate();
								}
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
			let metadata = activeFeatures[i] && activeFeatures[i].feature ? "" : "Please use the inputs above to select a feature";

			if (activeFeatures[i] && activeFeatures[i].metadata) {
				let image = activeFeatures[i].metadata.motifName ? (<Image src={'http://motifcollections.aertslab.org/v8/logos/'+activeFeatures[i].metadata.motifName} />) : '';
				let genes = "";
				if (activeFeatures[i].metadata.genes) {
					genes = (
						<Grid columns={4} className="geneInfo">
							{ activeFeatures[i].metadata.genes.map( (g, j) => (
								<Grid.Column key={j}>
									<a
										className="pointer"
										onClick={() => {
											let query = {
												loomFilePath: BackendAPI.getActiveLoom(),
												query: g
											};
											if (activePage == 'regulon') {
												this.setState({currentPage: 'expression'});
												BackendAPI.setActivePage('expression');
											}
											BackendAPI.getConnection().then((gbc) => {
												gbc.services.scope.Main.getFeatures(query, (err, response) => {
													BackendAPI.setActiveFeature(i, activeFeatures[i].type, "gene", g, 0, {description: response.featureDescription[0]});
												});
											})
										}} >
										{g}
									</a>
								</Grid.Column>
							))}
						</Grid>
					);
				}

				metadata = (
					<span>
						{activeFeatures[i].metadata.description}<br />
						{image}
						{genes}
					</span>
				);
			}

			return (
				<Tab.Pane attached={false} key={i} className={'feature'+i} style={{textAlign: 'center'}}>
					{activeFeatures[i] ? activeFeatures[i].featureType : ''} <b> {activeFeatures[i] ? activeFeatures[i].feature : ''} </b><br /><br />
					{metadata}<br /><br /><br />
				</Tab.Pane>
			)
		}

		let panes = [
			{ menuItem: 'Cell selections', render: lassoTab },
		]
		_.times(3, i => {
				panes.push({
					menuItem: activeFeatures[i] && activeFeatures[i].feature ? ("F"+(i+1)+": " + activeFeatures[i].feature) : "F"+(i+1),
					render: () => featureTab(i),
				})
		})

		return (
			<div>
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
				<Metadata selectionId={this.state.modalID} onClose={() =>{
					this.setState({modalID: null});
					this.forceUpdate();
				}} />
			</div>
		);
	}

	componentWillMount() {
		BackendAPI.onViewerSelectionsChange(this.selectionsListener);
		BackendAPI.onActiveFeaturesChange(this.state.activePage, this.activeFeaturesListener);
	}

	componentWillUnmount() {
		BackendAPI.removeViewerSelectionsChange(this.selectionsListener);
		BackendAPI.removeActiveFeaturesChange(this.state.activePage, this.activeFeaturesListener);
	}

	toggleLassoSelection(id) {
		BackendAPI.toggleLassoSelection(id);
	}

	removeLassoSelection(id) {
		BackendAPI.removeViewerSelection(id);
	}
}
