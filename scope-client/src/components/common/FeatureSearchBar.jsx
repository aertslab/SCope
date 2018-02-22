import _ from 'lodash'
import React, { Component } from 'react'
import { Label, Menu } from 'semantic-ui-react'
import FeatureSearchBox from '../common/FeatureSearchBox';

export default class FeatureSearchBar extends React.Component {

	constructor() {
		super()
		this.colors = ["red", "green", "blue"]
	}

	render() {
		const { type, locked } = this.props

		let querySearchLabel = {
			position: 'relative',
			top: 1, 
			left: 15, 
			height: 38
		}
	
		let noPadding = {
			padding: 0
		}

		let featureSearchInputs = _.times(3, i => (
			<Menu.Item key={i} style={noPadding}>
				<Menu secondary style={noPadding}>
					<Menu.Item style={{padding: 0, display: 'block'}}>
						<Label color={this.colors[i]} style={querySearchLabel}></Label>
					</Menu.Item>
					<Menu.Item style={noPadding}>
						<FeatureSearchBox key={i} id={i} color={this.colors[i]} type={type} locked={locked} value={this.props.activeFeatures[i].value} />
					</Menu.Item>
				</Menu>
			</Menu.Item>
		))

		return (
			<Menu secondary style={{padding: 0}}>
				{ featureSearchInputs }
			</Menu>
		);
	}

}