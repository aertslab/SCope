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
			loomFiles: BackendAPI.getLoomFiles(),
			activeLoom: BackendAPI.getActiveLoom(),
			multiLoom: [BackendAPI.getActiveLoom()],
			activeCoordinates: BackendAPI.getActiveCoordinates(),
			metadata: BackendAPI.getActiveLoomMetadata(),
			activeFeatures: BackendAPI.getActiveFeatures(),
			colors: BackendAPI.getColors(),
			activeAnnotation: -1,
			columns: 2,
			rows: 2,
			crossAnnotations: {
				horizontal: [], 
				vertical: [], 
				both: []
			},
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
			{ text: 'multi-dataset', value: 'multi' },
		]
		this.loomConf = [];
		Object.keys(this.state.loomFiles).map(l => {
			this.loomConf.push({text: l, value: l});
		});
	}

	render() {
		const { activeLoom, activeThresholds, activeFeatures, crossAnnotations, metadata, activeCoordinates, activeAnnotation, annotationIDs, columns, rows, colors } = this.state;

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

		let viewers = () => {
			return (
				<Grid>
				{_.times(rows, i => (
					<Grid.Row columns={columns} key={i}>
						{_.times(columns, (j) => {
								let name = "comp"+(columns * i + j);
								let annotationDropContainerHorizontal, annotationDropContainerVertical, datasetSelector;
								if ((this.state.configuration == 'simple') || ((this.state.configuration == 'cross') && (i == 0))) {
									annotationDropContainerHorizontal = (
										<AnnotationDropContainer 
											activeAnnotations={this.state.configuration == 'cross' ? crossAnnotations['horizontal'][j] : crossAnnotations['both'][columns * i + j]} 
											viewerName={name} 
											orientation={this.state.configuration == 'cross' ? 'horizontal' : 'both'}
											position={this.state.configuration == 'cross' ? j : columns * i + j}
											height={this.height / rows}
											onDrop={this.handleDrop.bind(this)}
											onRemove={this.handleRemove.bind(this)}
										/>
									)
								}
								if (((this.state.configuration == 'cross') || (this.state.configuration == 'multi')) && (j == 0)) {
									annotationDropContainerVertical = (
										<AnnotationDropContainer 
											activeAnnotations={crossAnnotations['vertical'][i]} 
											viewerName={name} 
											position={i}
											orientation='vertical'
											height={this.height / rows}
											onDrop={this.handleDrop.bind(this)}
											onRemove={this.handleRemove.bind(this)}
										/>
									)
								}
								if ((this.state.configuration == 'multi') && (i == 0)) {
									datasetSelector = (
										<span>
										<b>Select a dataset: </b>
										<Dropdown inline options={this.loomConf} disabled={j==0} defaultValue={this.state.multiLoom[j]} placeholder=" none selected " onChange={(proxy, select) => {
											let ml = this.state.multiLoom;
											ml[j] = select.value;
											this.setState({multiLoom: ml});
										}}/>
										</span>
									)
								}
								let va = this.state.configuration == 'simple' ? crossAnnotations['both'][columns * i + j] : this.getCrossAnnotations(i, j);
								return (
									<Grid.Column key={j}>
										{datasetSelector}
										{annotationDropContainerHorizontal}
										{annotationDropContainerVertical}
										<ViewerDropContainer
											active={this.state.configuration == 'simple' ? true : false}
											key={columns * i + j}
											onDrop={this.handleDrop.bind(this)}
											onRemove={this.handleRemove.bind(this)}
											name={name}
											height={this.height / rows}
											loomFile={this.state.configuration == 'multi' ? this.state.multiLoom[j] : activeLoom}
											activeFeatures={activeFeatures}
											activeCoordinates={activeCoordinates}
											activeAnnotations={va}
											orientation='both'
											position={columns * i + j}
											onScaleChange={this.onScaleChange.bind(this)}
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
		let annotations = this.state.crossAnnotations;
		Object.keys(annotations).map(orientation => {
			annotations[orientation].map(annotation => {
				let va = annotation[name];
				if (va && va.indexOf(value) != -1) selected = true;
			})
		})
		return selected;
	}

	handleDrop(item, viewer, orientation, position) {
		let isDropped = false;
		if (DEBUG) console.log('handleDrop', item, viewer, orientation, position);
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

	handleRemove(viewer, name, value, orientation, position) {
		if (DEBUG) console.log('handleRemove', viewer, name, value, orientation, position);
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

	onScaleChange() {

	}

}

export default DragDropContext(HTML5Backend)(DNDCompare);