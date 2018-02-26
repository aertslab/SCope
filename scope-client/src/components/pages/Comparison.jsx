import React, { Component } from 'react'
import { BackendAPI } from '../common/API'
import { Accordion, Grid, Form, Icon } from 'semantic-ui-react'
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
            activeFeatures: BackendAPI.getActiveFeatures('gene'),
            activeAnnotation: -1,
            activeClustering: -1
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
        const { activeLoom, activeFeatures, metadata, activeCoordinates, activeAnnotation, activeClustering } = this.state;

        let annotationTabs = () => {
            if (metadata.cellMetaData && metadata.cellMetaData.annotations) {
                let annotations = metadata.cellMetaData.annotations;
                return annotations.map((annotation, annotationID) => {
                    return (
                        <span key={annotationID}>
                        <Accordion.Title active={activeAnnotation === annotationID} index={annotationID} onClick={this.changeAnnotation.bind(this)}>
                            <Icon name="dropdown" />
                            {annotation.name}
                        </Accordion.Title>
                        <Accordion.Content active={activeAnnotation == annotationID}>
                            <Form>
                                <Form.Group grouped>
                                    {annotation.values.map((value, valueID)=> {
                                        return (
                                            <Form.Checkbox label={value} name={"annotationValue"+annotationID} type="checkbox" value={valueID} key={valueID} />
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

        let clusteringTabs = () => {
            if (metadata.cellMetaData && metadata.cellMetaData.clusterings) {
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
                                <Accordion styled>
                                {clusteringTabs()}
                                </Accordion>
                                <ViewerToolbar />
                            </Grid.Column>
                            <Grid.Column width={6}>
                                <Viewer name="comp1" height={this.height} loomFile={activeLoom} activeFeatures={activeFeatures} activeCoordinates={activeCoordinates} />
                            </Grid.Column>
                            <Grid.Column width={6}>
                                <Viewer name="comp2" height={this.height} loomFile={activeLoom} activeFeatures={activeFeatures} activeCoordinates={activeCoordinates} />
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

    changeAnnotation(e, props) {
        const { index } = props;
        const { activeAnnotation } = this.state;
        this.setState({activeAnnotation : activeAnnotation == index ? -1 : index});
    }

    changeClustering(e, props) {
        const { index } = props;
        const { activeClustering } = this.state;
        this.setState({activeClustering : activeClustering == index ? -1 : index});
    }
}