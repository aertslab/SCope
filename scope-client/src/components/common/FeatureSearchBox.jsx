import React, { Component } from 'react'
import { Label, Menu } from 'semantic-ui-react'
import FeatureSearchInput from './FeatureSearchInput';
import { BackendAPI } from './API'

export default class FeatureSearch extends React.Component {

	constructor(props) {
		super(props)
		this.state = {
			isLoading: false,
			results: [],
			value: props.value
		};
	}

	render() {

		const { isLoading, value, results } = this.state
		const { type, locked, field, color } = this.props
		let querySearchLabel = {
			position: 'relative',
			top: 1,
			left: 15,
			height: 38
		}

		let noPadding = {
			padding: 0
		}

		return (
			<Menu.Item key={field} style={noPadding}>
				<Menu secondary style={noPadding}>
					<Menu.Item style={{padding: 0, display: 'block'}}>
						<Label color={color} style={querySearchLabel}></Label>
					</Menu.Item>
					<Menu.Item style={noPadding}>
						<FeatureSearchInput
							category
							loading={isLoading}
							onResultSelect={this.handleResultSelect.bind(this)}
							onSearchChange={this.handleSearchChange.bind(this)}
							results={results}
							value={value}
							type={type}
							locked={locked}
						/>
					</Menu.Item>
				</Menu>
			</Menu.Item>
		);
	}

	resetComponent() {
		this.setState({ isLoading: false, results: [], value: '' })
		BackendAPI.setActiveFeature(this.props.field, this.props.type, '');
	}

	handleResultSelect(e, { result }) {
		this.setState({ value: result.title })
		BackendAPI.setActiveFeature(this.props.field, result.type, result.title);
	}

	handleSearchChange(e, { value }) {
		this.setState({ isLoading: true, value })
		setTimeout(() => {
			if (this.state.value.length < 1) return this.resetComponent()
			let query = {
				loomFilePath: BackendAPI.getActiveLoom(),
				query: this.state.value
			};
			if (DEBUG) console.log("handleSearchChange", query);
			BackendAPI.getConnection().then((gbc) => {
				gbc.services.scope.Main.getFeatures(query, (err, response) => {
					if (DEBUG) console.log("handleSearchChange", response);
					if (response != null) {
						var genes = []
						var regulons = []
						for (var i = 0; i < response.feature.length; i++) {
							if (response.featureType[i] == 'gene') {
								genes.push({
									"title": response.feature[i],
									"type": response.featureType[i]
								});
							} else if (response.featureType[i] == 'regulon') {
								regulons.push({
									"title": response.feature[i],
									"type": response.featureType[i]
								});
							}
						};
						genes = {"name": "gene", "results": genes.slice(0, 10)}
						regulons = {"name": "regulon", "results": regulons.slice(0, 10)}
						let res = [];
						if (genes['results'].length && (this.props.type == 'all' || this.props.type == 'gene')) {
							res.push(genes);
						}
						if (regulons['results'].length && (this.props.type == 'all' || this.props.type == 'regulon')) {
							res.push(regulons);
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
			});
		}, 200)
	}

}
