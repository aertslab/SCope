import _ from 'lodash'
import React, { Component } from 'react'
import { BackendAPI } from '../common/API'
import { Accordion, Grid, Menu, Icon, Dropdown } from 'semantic-ui-react'
import FeatureSearchBox from '../common/FeatureSearchBox'
import ViewerSidebar from '../common/ViewerSidebar'
import ViewerToolbar from '../common/ViewerToolbar'

import { DragDropContext } from 'react-dnd'
import HTML5Backend, { NativeTypes } from 'react-dnd-html5-backend'
import Annotation from '../common/Annotation'
import AnnotationContainer from '../common/AnnotationContainer'

class DNDCompare extends Component {
    constructor(props) {
        super(props);
        this.state = {
            lastDroppedItem: null,
            droppedBoxNames: [],
            columns: 2,
            rows: 2,
            activeLoom: BackendAPI.getActiveLoom(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            metadata: BackendAPI.getActiveLoomMetadata(),
            activeFeatures: BackendAPI.getActiveFeatures('all'),
            activeAnnotation: -1,
            activeClustering: -1,
            viewerAnnotations: [],
            activeThresholds: [0,0,0]
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
    }

    render() {
        const { lastDroppedItem, activeLoom, activeThresholds, activeFeatures, viewerAnnotations, metadata, activeCoordinates, activeAnnotation, activeClustering, annotationIDs, columns, rows } = this.state;

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
                                            <Annotation name={annotation.name} value={value} key={valueID} isDropped={this.isDropped(name)} />
                                        );
                                    })}
                            </Menu>                            
                        </Accordion.Content>
                        </span>
                    );
                })
            }
        };
/*
        let clusteringTabs = () => {
            if (metadata && metadata.cellMetaData && metadata.cellMetaData.clusterings) {
                let clusterings = metadata.cellMetaData.clusterings;
                return clusterings.map((clustering, clusteringID) => {
                    return (
                        <span key={clusteringID}>
                        <Accordion.Title active={activeClustering === clusteringID} index={clusteringID} onClick={this.changeClustering.bind(this)}>
                            <Icon name="dropdown" />
                            {clustering.name}
                        </Accordion.Title>
                        <Accordion.Content active={activeClustering == clusteringID}>
                            <Menu vertical secondary>
                                    {clustering.clusters.map((value, valueID)=> {
                                        return (
                                            <Menu.Item label={value.description} name={"clusteringValue"+clusteringID} type="checkbox" value={value.id} key={value.id} />
                                        );
                                    })}
                            </Menu>
                        </Accordion.Content>
                        </span>
                    );
                })
            }
        };
*/
        let viewers = () => {
            return (
                <Grid>
                {_.times(rows, i => (
                    <Grid.Row columns={columns} key={i}>
                        {_.times(columns, (j) => {                        
                                let name = "comp"+(columns * i + j);
                                return (
                                    <Grid.Column key={j}>
                                        <AnnotationContainer
                                            key={columns * i + j}
                                            accepts='DNDProperty'
                                            lastDroppedItem={lastDroppedItem}
                                            onDrop={this.handleDrop.bind(this)}
                                            onRemove={this.handleRemove.bind(this)}
                                            name={name} 
                                            height={this.height / rows} 
                                            loomFile={activeLoom} 
                                            activeFeatures={activeFeatures} 
                                            activeCoordinates={activeCoordinates}
                                            activeAnnotations={viewerAnnotations[name]}
                                            thresholds={activeThresholds} 
                                            />
                                    </Grid.Column>
                                );
                        })}
                    </Grid.Row>
                ))}
                </Grid>
            );
        }

        return (
            <div>
                <div style={{display: activeLoom == null ? 'block' : 'none'}}>
                    Select the dataset to be analyzed
                </div>
                <div style={{display: activeLoom != null ? 'block' : 'none'}}>
                    <Grid>
                        <Grid.Row columns="4">
                            <Grid.Column width={2} >
                                Number of displays:
                                <Dropdown selection options={this.displayConf} defaultValue={4} onChange={this.displayNumberChanged.bind(this)}/>
                            </Grid.Column>
                            <Grid.Column width={4}>
                                <FeatureSearchBox field="0" color="red" type="all" value={activeFeatures[0].value} />
                            </Grid.Column>
                            <Grid.Column width={4}>
                                <FeatureSearchBox field="1" color="green" type="all" value={activeFeatures[1].value} />
                            </Grid.Column>
                            <Grid.Column width={4}>
                                <FeatureSearchBox field="2" color="blue" type="all" value={activeFeatures[2].value} />
                            </Grid.Column>
                        </Grid.Row>
                        <Grid.Row columns={3}>
                            <Grid.Column width={2}>
                                <Accordion styled>
                                {annotationTabs()}
                                </Accordion>
                                {/*
                                <br />
                                <Accordion styled>
                                {clusteringTabs()}
                                </Accordion>
                                */}
                                <ViewerToolbar />
                            </Grid.Column>
                            <Grid.Column width={12}>
                                {viewers()}
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </div>
            </div>
        );
    }

    isDropped(boxName) {
        return this.state.droppedBoxNames.indexOf(boxName) > -1
    }

    handleDrop(item, viewer) {
        if (DEBUG) console.log('handleDrop', item, viewer);
        let annotations = this.state.viewerAnnotations;
        if (!annotations[viewer]) annotations[viewer] = {};
        let selectedAnnotations = (annotations[viewer][item.name] || []).slice(0);
        selectedAnnotations.push(item.value);
        annotations[viewer][item.name] = selectedAnnotations;
        this.setState({ viewerAnnotations : annotations});
    }

    handleRemove(viewer, name, value) {
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
            if (DEBUG) console.log('handleRemove', viewer, name, value, selectedAnnotations);            
            this.setState({ viewerAnnotations : annotations});
        } else {
            console.log('Annotation cannot be found', viewer, name, remove);
        }
    }

    displayNumberChanged(proxy, selection) {
        console.log('displayNumberChanged', selection.value);
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

    componentWillMount() {
        BackendAPI.onActiveLoomChange(this.activeLoomListener);
        BackendAPI.onActiveFeaturesChange(this.activeFeaturesListener);
    }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
        BackendAPI.removeActiveFeaturesChange(this.activeFeaturesListener);
    }

    selectAnnotationGroup(e, props) {
        const { index } = props;
        const { activeAnnotation } = this.state;
        this.setState({activeAnnotation : activeAnnotation == index ? -1 : index, annotationIDs: []});
    }
/*
    changeClustering(e, props) {
        const { index } = props;
        const { activeClustering } = this.state;
        this.setState({activeClustering : activeClustering == index ? -1 : index});
    }
*/
}

export default DragDropContext(HTML5Backend)(DNDCompare);