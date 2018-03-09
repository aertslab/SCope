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
		console.log(activeTab);
		let lassoTab = () => {
			if (lassoSelections.length == 0) {
				return (
					<Tab.Pane attached={false}>No user's lasso selections</Tab.Pane>
				);
			}

			return (lassoSelections.map((lS, i) => {
				return (
					<Tab.Pane attached={false} key={i}>
					<Grid>
					<Grid.Row columns={3} key={i}>
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
							<Icon name='search' title='show metadata for this selection' style={{display: 'inline'}} onClick={(e,d) => {
								console.log('setting modalID', i)
								this.setState({modalID: i});								
								this.forceUpdate();
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
			let metadata;
			if (activeFeatures[i].metadata) {
				metadata = (
					<span>
						<Image src={'http://motifcollections.aertslab.org/v8/logos/'+activeFeatures[i].metadata.motifName} /><br />
						<Grid columns={4} className="geneInfo">
							{activeFeatures[i].metadata.genes.map( (g, j) => (
								<Grid.Column key={j}>
									<a 
										className="pointer"
										onClick={() => {
											if (activePage == 'regulon') {

											} else {
												BackendAPI.setActiveFeature(i, activeFeatures[i].type, "gene", g, 0, null);
											}
										}} >
										{g}
									</a>
								</Grid.Column>
							))}
						</Grid>
					</span>
				);
			}
			return (
				<Tab.Pane attached={false} key={i} className={'feature'+i}>
					{activeFeatures[i].featureType} <b> {activeFeatures[i].feature} </b><br />
					{metadata}
				</Tab.Pane>
			)
		}

		let panes = [
			{ menuItem: 'Cell selections', render: lassoTab },
		]
		_.times(3, i => {
			if (activeFeatures[i] && activeFeatures[i].feature.length)
				panes.push({ 
					menuItem: activeFeatures[i].feature, 
					render: () => featureTab(i),
				})
		})

		console.log('panes', panes);

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
					console.log('setting modalID', null)
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
