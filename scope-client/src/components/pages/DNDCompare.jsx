import _ from 'lodash'
import React, { Component } from 'react'
import { DragDropContext } from 'react-dnd'
import HTML5Backend, { NativeTypes } from 'react-dnd-html5-backend'
import { Accordion, Grid, Menu, Icon, Dropdown } from 'semantic-ui-react'
import { BackendAPI } from '../common/API'
import Annotation from '../common/Annotation'
import FeatureSearchBox from '../common/FeatureSearchBox'
import ViewerSidebar from '../common/ViewerSidebar'
import ViewerToolbar from '../common/ViewerToolbar'
import AnnotationDropContainer from '../common/AnnotationDropContainer'
import ViewerDropContainer from '../common/ViewerDropContainer'

class DNDCompare extends Component {
	constructor(props) {
		super(props);
		this.state = {
			activeLoom: BackendAPI.getActiveLoom(),
			activeCoordinates: BackendAPI.getActiveCoordinates(),
			metadata: BackendAPI.getActiveLoomMetadata(),
			activeFeatures: BackendAPI.getActiveFeatures(),
			colors: BackendAPI.getColors(),
			activeAnnotation: -1,
			columns: 2,
			rows: 2,
			viewerAnnotations: {},
			crossAnnotations: {'horizontal': [], 'vertical': []},
			configuration: 'simple',
		}
		this.activeLoomListener = (loom, metadata, coordinates) => {
			this.setState({activeLoom: loom, activeCoordinates: coordinates, metadata: metadata});
		};
		this.activeFeaturesListener = (features) => {
			this.setState({activeFeatures: features});
		}
		this.height = window.innerHeight - 200;
		this.displayConf = [
			{ text: '1', value: 1 },
			{ text: '2', value: 2 },
			{ text: '4', value: 4 },
			{ text: '6', value: 6 },
			{ text: '9', value: 9 }
		]
		this.superpositionConf = [
			{ text: 'AND', value: 'AND' },
			{ text: 'OR', value: 'OR' }
		]
		this.configurationConf = [
			{ text: 'simple', value: 'simple' },
			{ text: 'cross-reference', value: 'cross' },
		]
	}

	render() {
		const { activeLoom, activeThresholds, activeFeatures, viewerAnnotations, crossAnnotations, metadata, activeCoordinates, activeAnnotation, annotationIDs, columns, rows, colors } = this.state;

		let annotationTabs = () => {
			if (metadata && metadata.cellMetaData && metadata.cellMetaData.annotations) {
				let annotations = metadata.cellMetaData.annotations;
				return annotations.map((annotation, annotationID) => {
					return (
						<span key={annotationID}>
						<Accordion.Title active={activeAnnotation === annotationID} index={annotationID} onClick={this.selectAnnotationGroup.bind(this)}>
							<Icon name="dropdown" />
							{annotation.name}
						</Accordion.Title>
						<Accordion.Content active={activeAnnotation == annotationID}>
							<Menu vertical secondary>
									{annotation.values.map((value, valueID)=> {
										return (
											<Annotation name={annotation.name} value={value} key={valueID} isDropped={this.isDropped(annotation.name, value)} />
										);
									})}
							</Menu>
						</Accordion.Content>
						</span>
					);
				})
			}
		};

		let annotationTags = (viewerName) => {
			if (viewerAnnotations[viewerName]) {
				return Object.keys(viewerAnnotations[viewerName]).map((name, i) => {
					return viewerAnnotations[viewerName][name].map((value, j) => {
						return (
							<Annotation name={name} value={value} key={j} label isDropped={this.isDropped(name, value)} src={viewerName} handleRemove={this.handleRemove.bind(this)} />
						);
					});
				});
			} else {
				return (
					<b>&nbsp;</b>
				);
			}
		}

		let viewers = () => {
			return (
				<Grid>
				{_.times(rows, i => (
					<Grid.Row columns={columns} key={i}>
						{_.times(columns, (j) => {
								let name = "comp"+(columns * i + j);
								let annotationDropContainerHorizontal, annotationDropContainerVertical;
								if ((this.state.configuration == 'simple') || (i == 0)) {
									annotationDropContainerHorizontal = (
										<AnnotationDropContainer 
											activeAnnotations={this.state.configuration == 'cross' ? crossAnnotations['horizontal'][j] : viewerAnnotations[name]} 
											viewerName={name} 
											orientation={this.state.configuration == 'cross' ? 'horizontal' : null}
											position={j}
											height={this.height / rows}
											onDrop={this.handleDrop.bind(this)}
											onRemove={this.handleRemove.bind(this)}
										/>
									)
								}
								if ((this.state.configuration == 'cross') && (j == 0)) {
									annotationDropContainerVertical = (
										<AnnotationDropContainer 
											activeAnnotations={crossAnnotations['vertical'][i]} 
											viewerName={name} 
											position={i}
											orientation={this.state.configuration == 'cross' ? 'vertical' : null}
											height={this.height / rows}
											onDrop={this.handleDrop.bind(this)}
											onRemove={this.handleRemove.bind(this)}
										/>
									)
								}
								let va = this.state.configuration == 'cross' ? this.getCrossAnnotations(i, j): viewerAnnotations[name];
								return (
									<Grid.Column key={j}>
										{annotationDropContainerHorizontal}
										{annotationDropContainerVertical}
										<ViewerDropContainer
											active={this.state.configuration == 'simple' ? true :false}
											key={columns * i + j}
											onDrop={this.handleDrop.bind(this)}
											onRemove={this.handleRemove.bind(this)}
											name={name}
											height={this.height / rows}
											loomFile={activeLoom}
											activeFeatures={activeFeatures}
											activeCoordinates={activeCoordinates}
											activeAnnotations={va}
											customScale={true}
											settings={true}
											scale={true}
										/>
									</Grid.Column>
								);
						})}
					</Grid.Row>
				))}
				</Grid>
			);
		}

		let featureSearch = _.times(3, i => (
			<Grid.Column width={4} key={i}>
				<FeatureSearchBox field={i} color={colors[i]} type='all' value={activeFeatures[i] ? activeFeatures[i].feature : ''} />
			</Grid.Column>
		));

		if (!activeLoom) return (
			<div>
				Select the dataset to be analyzed
			</div>
		);

		return (
			<Grid>
				<Grid.Row columns="4">
					<Grid.Column width={2} >
						Number of displays: &nbsp;
						<Dropdown inline options={this.displayConf} defaultValue={4} onChange={this.displayNumberChanged.bind(this)}/>
						<br />
						Superposition: &nbsp;
						<Dropdown inline disabled options={this.superpositionConf} defaultValue={'OR'} onChange={this.superpositionChanged.bind(this)}/>
						<br />
						Configuration: &nbsp;
						<Dropdown inline options={this.configurationConf} defaultValue={'simple'} onChange={this.configurationChanged.bind(this)}/>
					</Grid.Column>
					{featureSearch}
				</Grid.Row>
				<Grid.Row columns={3}>
					<Grid.Column width={2}>
						<Accordion styled>
						{annotationTabs()}
						</Accordion>
						<br />
						<ViewerToolbar />
					</Grid.Column>
					<Grid.Column width={12}>
						{viewers()}
					</Grid.Column>
				</Grid.Row>
			</Grid>
		);
	}

	componentWillMount() {
		BackendAPI.onActiveLoomChange(this.activeLoomListener);
	}

	componentWillUnmount() {
		BackendAPI.removeActiveLoomChange(this.activeLoomListener);
	}

	isDropped(name, value) {
		let selected = false;
		if (this.state.configuration == 'simple') {
			let annotations = this.state.viewerAnnotations;
			Object.keys(annotations).map(viewer => {
				let va = annotations[viewer][name];
				if (va && va.indexOf(value) != -1) selected = true;
			})
		} 
		if (this.state.configuration == 'cross') {
			let annotations = this.state.crossAnnotations;
			Object.keys(annotations).map(orientation => {
				annotations[orientation].map(annotation => {
					let va = annotation[name];
					if (va && va.indexOf(value) != -1) selected = true;
				})
			})
		}
		return selected;
	}

	handleDrop(item, viewer, orientation, position) {
		if (DEBUG) console.log('handleDrop', item, viewer, orientation, position);
		if (this.state.configuration == 'simple') {
			let annotations = this.state.viewerAnnotations;
			if (!annotations[viewer]) annotations[viewer] = {};
			let selectedAnnotations = (annotations[viewer][item.name] || []).slice(0);
			if (selectedAnnotations.indexOf(item.value) != -1) {
				alert('This annotation is already shown in that viewer');
				return false;
			}
			selectedAnnotations.push(item.value);
			annotations[viewer][item.name] = selectedAnnotations;
			this.setState({ viewerAnnotations : annotations});
			return true;
		} else if (this.state.configuration == 'cross') {
			let annotations = this.state.crossAnnotations;
			if (!annotations[orientation][position]) annotations[orientation][position] = {};
			let selectedAnnotations = (annotations[orientation][position][item.name] || []).slice(0);
			if (selectedAnnotations.indexOf(item.value) != -1) {
				alert('This annotation is already shown in that viewer');
				return false;
			}
			selectedAnnotations.push(item.value);
			annotations[orientation][position][item.name] = selectedAnnotations;
			this.setState({ crossAnnotations : annotations});
			return true;
		}
	}

	handleRemove(viewer, name, value, orientation, position) {
		if (DEBUG) console.log('handleRemove', viewer, name, value, orientation, position);
		if (this.state.configuration == 'simple') {
			let annotations = this.state.viewerAnnotations;
			if (!annotations[viewer]) return;
			let selectedAnnotations = (annotations[viewer][name] || []).slice(0);
			let idx = selectedAnnotations.indexOf(value);
			if (idx != -1) {
				selectedAnnotations.splice(idx, 1);
				if (selectedAnnotations.length == 0) {
					delete(annotations[viewer][name]);
				} else {
					annotations[viewer][name] = selectedAnnotations;
				}
				this.setState({ viewerAnnotations : annotations});
			} else {
				console.log('Annotation cannot be found', viewer, name, remove);
			}
		} else if (this.state.configuration == 'cross') {
			let cross = this.state.crossAnnotations;
			let annotations = cross[orientation][position] || {};
			let selectedAnnotations = (annotations[name] || []).slice(0);
			let idx = selectedAnnotations.indexOf(value);
			if (idx != -1) {
				selectedAnnotations.splice(idx, 1);
				if (selectedAnnotations.length == 0) {
					delete(cross[orientation][position][name]);
				} else {
					cross[orientation][position][name] = selectedAnnotations;
				}
				this.setState({ crossAnnotations : cross});
			} else {
				console.log('Annotation cannot be found', viewer, name, remove);
			}
		}
	}

	displayNumberChanged(proxy, selection) {
		setTimeout(() => {
			if (selection.value == 1) {
				this.setState({columns: 1, rows: 1});
			} else if(selection.value == 2) {
				this.setState({columns: 2, rows: 1});
			} else if(selection.value == 4) {
				this.setState({columns: 2, rows: 2});
			} else if(selection.value == 6) {
				this.setState({columns: 3, rows: 2});
			} else if(selection.value == 9) {
				this.setState({columns: 3, rows: 3});
			}
		}, 100);
	}

	superpositionChanged(proxy, selection) {
		setTimeout(() => {
		}, 100);
	}

	configurationChanged(proxy, selection) {
		setTimeout(() => {
			this.setState({configuration: selection.value});
		}, 100);
	}


	selectAnnotationGroup(e, props) {
		const { index } = props;
		const { activeAnnotation } = this.state;
		this.setState({activeAnnotation : activeAnnotation == index ? -1 : index, annotationIDs: []});
	}

	getCrossAnnotations(i, j) {
		let annotations = {}, cross = this.state.crossAnnotations;		
		if (cross['horizontal'][j]) {
			Object.keys(cross['horizontal'][j]).map(a => {
				annotations[a] = annotations[a] || [];
				cross['horizontal'][j][a].map(v => {
					if (annotations[a].indexOf(v) == -1) annotations[a].push(v);
				})
			})
		}
		if (cross['vertical'][i]) {
			Object.keys(cross['vertical'][i]).map(a => {
				annotations[a] = annotations[a] || [];
				cross['vertical'][i][a].map(v => {
					if (annotations[a].indexOf(v) == -1) annotations[a].push(v);
				})
			})
		}
		return annotations;
	}

}

export default DragDropContext(HTML5Backend)(DNDCompare);