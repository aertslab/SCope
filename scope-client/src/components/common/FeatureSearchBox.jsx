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
			value: props.value,
			selection: null,
			type: props.type
		};
	}

	render() {

		const { isLoading, value, results, type } = this.state
		const { locked, field, color, options } = this.props
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
							handleTypeChange={this.handleTypeChange.bind(this)}
							onSelectionChange={this.handleSelectionChange.bind(this)}
							onBlur={this.handleBlur.bind(this)}
							results={results}
							options={options}
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
		this.setState({ isLoading: false, results: [], value: '', selection: null })
		BackendAPI.setActiveFeature(this.props.field, this.state.type, '', '', 0);
	}

	handleResultSelect(e, { result }) {
		if (DEBUG) console.log('handleResultSelect', e, result);
		this.setState({ value: result.title })
		BackendAPI.setActiveFeature(this.props.field, this.state.type, result.type, result.title, 0);
	}

	handleTypeChange(type) {
		this.setState({type: type});
	}

	handleSelectionChange(e, { result }) {
		this.setState({selection: result})
	}

	handleBlur(e) {
		let selection = this.state.selection;
		if (DEBUG) console.log('handleBlur', e, selection);
		if (selection) {
			this.setState({ value: selection.title })
			BackendAPI.setActiveFeature(this.props.field, this.state.type, selection.type, selection.title, 0);
		}
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
						let res = [], genes = [], regulons = [], clusters = {};
            			let metadata = BackendAPI.getActiveLoomMetadata();
						let type = this.state.type;

						for (var i = 0; i < response.feature.length; i++) {
							let f = response.feature[i];
							let ft = response.featureType[i];
							if (ft == 'gene') {
								genes.push({ "title": f, "type": ft });
							} else if (ft == 'regulon') {
								regulons.push({ "title": f, "type": ft });
							} else if (ft.indexOf('Clustering:') == 0) {
								if (!clusters[ft]) clusters[ft] = [];
								clusters[ft].push({ "title": f, "type": ft });
							} else if (ft.indexOf('cluster#') == 0) {
								let cid = ft.split('#')[1], name = '';
            					activeMetadata.cellMetaData.clusterings.map((c, i) => {
            						if (c.id == cid) {
            							name = c.name;
            						}
            					})
								if (!clusters[ft]) clusters[ft] = {name: name, results: []};
								clusters[ft].push({ "title": f, "type": ft });
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
			});
		}, 200)
	}

}
