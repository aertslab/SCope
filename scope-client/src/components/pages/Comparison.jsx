import _ from 'lodash'
import React, { Component } from 'react'
import { BackendAPI } from '../common/API'
import { Accordion, Grid, Form, Icon, Button } from 'semantic-ui-react'
import FeatureSearchBox from '../common/FeatureSearchBox'
import Viewer from '../common/Viewer'
import ViewerSidebar from '../common/ViewerSidebar'
import ViewerToolbar from '../common/ViewerToolbar'

export default class Comparison extends Component {
    constructor(props) {
        super(props);
        this.state = {
            activeLoom: BackendAPI.getActiveLoom(),
            activeCoordinates: BackendAPI.getActiveCoordinates(),
            metadata: BackendAPI.getActiveLoomMetadata(),
            activeFeatures: BackendAPI.getActiveFeatures('all'),
            activeAnnotation: -1,
            activeClustering: -1,
            annotationIDs: []
        }
        this.activeLoomListener = (loom, metadata, coordinates) => {
            this.setState({activeLoom: loom, activeCoordinates: coordinates, metadata: metadata});
        };
        this.activeFeaturesListener = (features) => {
            this.setState({activeFeatures: features});
        }
        this.height = window.innerHeight - 200;
    }

    render() {
        const { activeLoom, activeFeatures, metadata, activeCoordinates, activeAnnotation, activeClustering, annotationIDs } = this.state;

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
                            <Form>
                                <Form.Group grouped>
                                    {annotation.values.map((value, valueID)=> {
                                        return (
                                            <Form.Checkbox checked={annotationIDs.indexOf(value) !=-1} label={value} name={'annotation-'+annotationID+'-'+valueID} type="checkbox" value={valueID} key={valueID} onClick={this.changeAnnotation.bind(this)} />
                                        );
                                    })}
                                </Form.Group>
                            </Form>
                            <span style={{float: 'right'}}><a onClick={this.selectAllAnotations.bind(this)}>all</a> - <a onClick={this.selectNoAnotations.bind(this)}>none</a></span>
                        </Accordion.Content>
                        </span>
                    );
                })
            }
        };

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
                            <Form>
                                <Form.Group grouped>
                                    {clustering.clusters.map((value, valueID)=> {
                                        return (
                                            <Form.Checkbox label={value.description} name={"clusteringValue"+clusteringID} type="checkbox" value={value.id} key={value.id} />
                                        );
                                    })}
                                </Form.Group>
                            </Form>
                        </Accordion.Content>
                        </span>
                    );
                })
            }
        };

        let columns = 1;
        while (annotationIDs.length > columns * columns) {
            columns++;
        }
        let rows = columns;
        while (columns * (rows - 1) >= annotationIDs.length) {
            rows --;
        }
        console.log('number of columns', columns, 'rows', rows);

        let viewers = (
            <Grid>
            {_.times(rows, i => (
                <Grid.Row columns={columns} key={i}>
                    {_.times(columns, (j) => {
                        if ((columns * i + j ) < annotationIDs.length)
                        return (
                            <Grid.Column key={j}>
                                <b>{metadata.cellMetaData.annotations[activeAnnotation].name} {annotationIDs[columns * i + j]}</b>
                                <Viewer name={"comp"+(columns * i + j)} height={this.height / rows} loomFile={activeLoom} activeFeatures={activeFeatures} activeCoordinates={activeCoordinates} />
                            </Grid.Column>
                        );
                    })}
                </Grid.Row>
            ))}
            </Grid>
        );

        return (
            <div>
                <div style={{display: activeLoom == null ? 'block' : 'none'}}>
                    Select the dataset to be analyzed
                </div>
                <div style={{display: activeLoom != null ? 'block' : 'none'}}>
                    <Grid>
                        <Grid.Row columns="4">
                            <Grid.Column width={2} />
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
                                {viewers}
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </div>
            </div>
        );
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

    selectAllAnotations() {
        const { activeAnnotation, metadata } = this.state;
        let annotationIDs = [];
        metadata.cellMetaData.annotations[activeAnnotation].values.map((value, valueID) => {
            annotationIDs.push(value);
        });
        this.setState({annotationIDs: annotationIDs});
    }

    selectNoAnotations() {
        this.setState({annotationIDs: []});
    }

    changeAnnotation(e, props) {
        console.log('changeAnnotation', props);
        let annotationIDs = this.state.annotationIDs;
        if (props.checked) {
            annotationIDs.push(props.label);
        } else {
            annotationIDs.splice(annotationIDs.indexOf(props.label), 1);
        }
        this.setState({annotationIDs: annotationIDs});
    }

    changeClustering(e, props) {
        const { index } = props;
        const { activeClustering } = this.state;
        this.setState({activeClustering : activeClustering == index ? -1 : index});
    }
}