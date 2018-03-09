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
			displays: 4,
			crossAnnotations: {
				horizontal: [], 
				vertical: [], 
				both: [],
				one: []
			},
			configuration: 'simple',
			superposition: 'OR',
		}
		this.activeLoomListener = (loom, metadata, coordinates) => {
			this.setState({activeLoom: loom, activeCoordinates: coordinates, metadata: metadata});
		};
		this.activeFeaturesListener = (features) => {
			this.setState({activeFeatures: features});
		}
		this.height = window.innerHeight - 200;
		this.displayConf = [
			{ text: 'auto', value: 0, disabled: true },
			{ text: '1', value: 1 },
			{ text: '2', value: 2 },
			{ text: '4', value: 4 },
			{ text: '6', value: 6 },
			{ text: '9', value: 9 }
		]
		this.superpositionConf = [
			{ text: 'N/A', value: 'NA', disabled: true },
			{ text: 'AND', value: 'AND' },
			{ text: 'OR', value: 'OR' }
		]
		this.configurationConf = [
			{ text: 'drag-and-drop', value: 'simple' },
			{ text: 'one-type', value: 'one' },
			{ text: 'cross-reference', value: 'cross' },
			{ text: 'multi-dataset', value: 'multi' },
		]
		this.loomConf = [];
		Object.keys(this.state.loomFiles).map(l => {
			this.loomConf.push({text: l, value: l});
		});
	}

	render() {
		const { 
			activeLoom, 
			activeThresholds, 
			activeFeatures, 
			crossAnnotations, 
			metadata, 
			activeCoordinates, 
			activeAnnotation, 
			annotationIDs, 
			colors, 
			displays,
			configuration,
			superposition,
			multiLoom
		} = this.state;

		let annotationLinks = () => {
			if (configuration == 'one') return (
				<span style={{float: 'right'}}>
					<a className="pointer" onClick={this.selectAllAnotations.bind(this)}>all</a> - <a className="pointer" onClick={this.selectNoAnotations.bind(this)}>none</a>
				</span>
			)
		}

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
											<Annotation name={annotation.name} value={value} key={valueID} isDropped={this.isDropped(annotation.name, value)} onClick={this.selectAnnotation.bind(this)} />
										);
									})}
							</Menu>
							{annotationLinks()}
						</Accordion.Content>
						</span>
					);
				})
			}
		};

		let columns = this.state.columns;
		let rows = this.state.rows;
		if (configuration == 'one') {
			columns = 1;
			while (crossAnnotations['one'].length > columns * columns) {
				columns++;
			}
			rows = columns;
			while (columns * (rows - 1) >= crossAnnotations['one'].length) {
				rows --;
			}
			console.log('number of columns', columns, 'rows', rows);
			if (rows < 1) rows = 1;
		}


		let viewers = () => {
			return (
				<Grid>
				{_.times(rows, i => (
					<Grid.Row columns={columns} key={i}>
						{_.times(columns, (j) => {
								let name = "comp"+(columns * i + j);
								let annotationDropContainerHorizontal, annotationDropContainerVertical, datasetSelector;
								if ((configuration == 'simple') || (configuration == 'one') || ((configuration == 'cross') && (i == 0))) {
									let ca = crossAnnotations['horizontal'][j];
									if (configuration == 'simple') ca = crossAnnotations['both'][columns * i + j];
									if (configuration == 'one') ca = crossAnnotations['one'][columns * i + j];
									annotationDropContainerHorizontal = (
										<AnnotationDropContainer 
											activeAnnotations={ca} 
											viewerName={name} 
											orientation={configuration == 'cross' ? 'horizontal' : (configuration == 'one' ? 'one' : 'both')}
											position={configuration == 'cross' ? j : columns * i + j}
											height={this.height / rows}
											onDrop={this.handleDrop.bind(this)}
											onRemove={this.handleRemove.bind(this)}
										/>
									)
								}
								if (((configuration == 'cross') || (configuration == 'multi')) && (j == 0)) {
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
								if ((configuration == 'multi') && (i == 0)) {
									datasetSelector = (
										<span>
										<b>Select a dataset: </b>
										<Dropdown inline options={this.loomConf} disabled={j==0} defaultValue={multiLoom[j]} placeholder=" none selected " onChange={(proxy, select) => {
											let ml = multiLoom;
											ml[j] = select.value;
											this.setState({multiLoom: ml});
										}}/>
										</span>
									)
								}
								let va;
								if (configuration == 'simple') va = crossAnnotations['both'][columns * i + j];
								else if (configuration == 'one') va = crossAnnotations['one'][columns * i + j]
								else va = this.getCrossAnnotations(i, j);
								return (
									<Grid.Column key={j}>
										{datasetSelector}
										{annotationDropContainerHorizontal}
										{annotationDropContainerVertical}
										<ViewerDropContainer
											active={configuration == 'simple' ? true : false}
											key={columns * i + j}
											onDrop={this.handleDrop.bind(this)}
											onRemove={this.handleRemove.bind(this)}
											name={name}
											height={this.height / rows}
											loomFile={configuration == 'multi' ? multiLoom[j] : activeLoom}
											activeFeatures={activeFeatures}
											activeCoordinates={activeCoordinates}
											activeAnnotations={va}
											orientation={configuration =='one' ? 'one' : 'both'}
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
						<Dropdown inline options={this.displayConf} disabled={configuration=='one'} value={displays} onChange={this.displayNumberChanged.bind(this)}/>
						<br />
						Superposition: &nbsp;
						<Dropdown inline disabled options={this.superpositionConf} value={superposition} onChange={this.superpositionChanged.bind(this)}/>
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
				this.setState({columns: 1, rows: 1, displays: 1});
			} else if(selection.value == 2) {
				this.setState({columns: 2, rows: 1, displays: 2});
			} else if(selection.value == 4) {
				this.setState({columns: 2, rows: 2, displays: 4});
			} else if(selection.value == 6) {
				this.setState({columns: 3, rows: 2, displays: 6});
			} else if(selection.value == 9) {
				this.setState({columns: 3, rows: 3, displays: 9});
			}
		}, 100);
	}

	superpositionChanged(proxy, selection) {
		setTimeout(() => {
			this.setState({superposition: selection.value});
		}, 100);
	}

	configurationChanged(proxy, selection) {
		setTimeout(() => {
			let conf = selection.value;
			let displays = this.state.displays;
			let superposition = this.state.superposition;
			let crossAnnotations = {
				horizontal: [], 
				vertical: [], 
				both: [],
				one: []
			}
			if (conf == 'one') {
				displays = 0;
				superposition = 'NA';
			} else {
				displays = this.state.rows * this.state.columns;
				superposition = 'OR';
			}			
			this.setState({configuration: conf, displays: displays, superposition: superposition, crossAnnotations: crossAnnotations});
		}, 100);
	}

	selectAllAnotations() {
        const { crossAnnotations, activeAnnotation, metadata } = this.state;
        let annotationIDs = [];
        let annotationGroup = metadata.cellMetaData.annotations[activeAnnotation];
        annotationGroup.values.map((value, valueID) => {
        	let a = {};
        	a[annotationGroup.name] = [value];
            annotationIDs.push(a);
        });
        crossAnnotations['one'] = annotationIDs;
        this.setState({crossAnnotations: crossAnnotations});
	}

	selectNoAnotations() {
		let { crossAnnotations } = this.state;
		crossAnnotations['one'] = [];
		this.setState({crossAnnotations: crossAnnotations});
	}

	selectAnnotation(name, value, selected) {
		if (this.state.configuration == 'one') {
			console.log('selectAnnotation', name, value, selected);
			let annotations = this.state.crossAnnotations;
			if (!selected) {
				let a = {};
				a[name] = [value];
				annotations['one'].push(a);
			} else {
				let idx = -1;
				annotations['one'].map((a, i) => {
					if (a[name][0] == value) {
						console.log('found', i)
						idx = i;
					}
				});
				annotations['one'].splice(idx, 1);
			}
			annotations['one'].sort((a, b) => {
				let va = a[name][0], vb = b[name][0];
				let pa = parseInt(va), pb = parseInt(vb);
				if (!isNaN(pa) && !isNaN(pb)) return pa > pb ? 1 : (pa < pb ? -1 : 0);
				return va > vb ? 1 : (va < vb ? -1 : 0);
			})
			console.log('annotations', annotations);
			this.setState({ crossAnnotations : annotations});
		}
	}

	selectAnnotationGroup(e, props) {
		const { index } = props;
		let { activeAnnotation, crossAnnotations } = this.state;
		crossAnnotations['one'] = [];
		this.setState({activeAnnotation : activeAnnotation == index ? -1 : index, crossAnnotations: crossAnnotations});
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