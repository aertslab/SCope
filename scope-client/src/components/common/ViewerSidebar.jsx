import React, { Component } from 'react'
import { Grid, Input, Icon } from 'semantic-ui-react'
import { BackendAPI } from '../common/API' 
import Metadata from '../common/Metadata' 

export default class ViewerSidebar extends Component {
	
	constructor() {
		super();
		this.state = {
			activePage: BackendAPI.getActivePage(),
			modalID: null,
			lassoSelections: BackendAPI.getViewerSelections()
		}
		this.selectionsListener = (selections) => {
			this.setState({lassoSelections: selections});
		}        
	}

	render() {

		let lassoSelections = () => {
			if (this.state.lassoSelections.length == 0) {
				return (
					<Grid.Column>No user's lasso selections</Grid.Column>
				);
			}

			return (this.state.lassoSelections.map((lS, i) => {
				return (
					<Grid.Row columns={3} key={i}>
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
				)
			}))
		}

		return (
			<div>
				<Grid>
					{lassoSelections()}
				</Grid>
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
	}

	componentWillUnmount() {
		BackendAPI.removeViewerSelectionsChange(this.selectionsListener);
	}

	toggleLassoSelection(id) {
		BackendAPI.toggleLassoSelection(id);
	}

	removeLassoSelection(id) {
		BackendAPI.removeViewerSelection(id);
	}
}
