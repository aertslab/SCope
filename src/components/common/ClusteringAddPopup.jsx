import React, { Component } from 'react';
import {
    Icon,
    Popup,
    Button,
    Modal,
    Divider,
    Header,
    Card,
    CardContent,
    Form,
    Input,
} from 'semantic-ui-react';
import { BackendAPI } from './API';
import _ from 'lodash';

import CSVReader from 'react-csv-reader';

export default class ClusteringAddPopup extends Component {
    constructor(props) {
        super(props);
        this.state = {
            status: 'ready',
            showModal: false,
            clusteringName: '',
        };
    }

    closeModal = () => {
        this.setState({ showModal: false });
        this.props.handleModalClose();
    };

    handleModalOpen = () => {
        this.props.handleModalOpen();
    };

    onClusteringNameChange = (e) => {
        this.setState({ clusteringName: e.target.value });
    };

    validateClusterData = (data, fileInfo) => {
        console.log(data, fileInfo);
        let cols = new Set();
        data.map((x) => {
            cols.add(x.length);
        });

        cols.delete(0);
        if (cols.size != 1) {
            this.setState({ status: 'dataError' });
            console.log(cols);
            alert(
                'Mismatched column lengths, please select a correctly formatted file!'
            );
        } else if (!cols.has(2)) {
            console.log(cols);
            this.setState({ status: 'dataError' });
            alert(
                'Incorrect number of columns, please select a correctly formatted file!'
            );
        } else {
            const clusterInfo = _.zip(...data);
            this.setState({
                status: 'ready',
                newclusterInfo: {
                    cellIDs: clusterInfo[0],
                    clusterIDs: clusterInfo[1],
                },
            });
        }
    };

    sendData = (e) => {
        if (this.state.clusteringName == '') {
            alert('You must enter a name for your clustering!');
            return;
        }
        const retVal = confirm(
            `Are you sure you want to add this new clustering?\n\n--> ${this.state.clusteringName} <--\n\nThis is a PERMANENT change!`
        );
        if (retVal == false) {
            return;
        }
        BackendAPI.getConnection().then((gbc) => {
            let query = {
                loomFilePath: BackendAPI.getActiveLoom(),
                orcidInfo: {
                    orcidName: this.props.orcid_name,
                    orcidID: this.props.orcid_id,
                    orcidUUID: this.props.orcid_uuid,
                },
                clusterInfo: {
                    ...{ clusteringName: this.state.clusteringName },
                    ...this.state.newclusterInfo,
                },
            };
            if (DEBUG) console.log('addNewClustering', query);
            this.setState({ status: 'processing' }, () => {
                gbc.services.scope.Main.addNewClustering(
                    query,
                    (err, response) => {
                        this.setState({ status: 'ready' });
                        if (DEBUG) console.log('addNewClustering', response);
                        if (response.success == true) {
                            this.closeModal();
                            // Maybe we can auto load the new clustering
                        } else if (response.success == false) {
                            alert(response.message);
                        }
                    }
                );
            });
        });
    };

    getButtonDisabledStatus = () => {
        const enabledStatuses = ['ready'];
        if (
            enabledStatuses.includes(this.state.status) &&
            this.state.newclusterInfo &&
            this.state.clusteringName != ''
        ) {
            return false;
        } else {
            return true;
        }
    };

    getButtonText = () => {
        console.log(this.state.status);
        if (this.state.status == 'ready') {
            return (
                <React.Fragment>
                    Submit Clustering... <Icon name='chevron right' />
                </React.Fragment>
            );
        } else if (this.state.status == 'processing') {
            return (
                <React.Fragment>
                    <Icon loading name='spinner' /> Processing
                </React.Fragment>
            );
        } else if (this.state.status == 'dataError') {
            return 'Bad file!';
        }
    };

    render() {
        const { showModal, status } = this.state;

        let cardStyle = {
            display: 'block',
            width: '100vw',
            transitionDuration: '0.3s',
        };

        let warningPopup = (trigger) => {
            return (
                <Popup
                    trigger={trigger}
                    content='By submitting a new clustering, your ORCID details will be permanently added to this loom file. Anyone with access to this file will be able to see your full name and ORCID ID'
                />
            );
        };

        let clusteringModal = () => {
            const { orcid_name, orcid_id } = this.props;
            return (
                <React.Fragment>
                    <Modal
                        as={Form}
                        className='clustering-add'
                        onOpen={this.handleModalOpen}
                        onClose={() => this.closeModal()}
                        closeIcon
                        open={showModal}
                        trigger={
                            <Button
                                onClick={() => {
                                    this.setState({ showModal: true });
                                }}
                                className='clustering-button'>
                                Add Clustering
                            </Button>
                        }
                        // onSubmit={e => {this.sendData(e)}}
                        id='clusteringAdd'>
                        <Modal.Header>Add Clustering</Modal.Header>
                        <Modal.Content scrolling>
                            <Divider horizontal>
                                <Header as='h4'>Basic Information</Header>
                            </Divider>
                            <Card style={cardStyle}>
                                <CardContent>
                                    <Form.Field>
                                        <label>
                                            Clustering Group (Read Only)
                                        </label>
                                        <input
                                            disabled
                                            value={`${orcid_id} (${orcid_name})`}
                                        />
                                    </Form.Field>
                                </CardContent>
                            </Card>
                            <Card style={cardStyle}>
                                <CardContent>
                                    <Form.Field required>
                                        <label>Clustering Name</label>
                                        <Input
                                            name='clusteringName'
                                            onChange={
                                                this.onClusteringNameChange
                                            }
                                            value={this.state.clusteringName}
                                            placeholder='Name of clustering'
                                        />
                                    </Form.Field>
                                </CardContent>
                            </Card>
                            <Divider horizontal>
                                <Header as='h4'>Cluster Information</Header>
                            </Divider>
                            <Card style={cardStyle}>
                                <CardContent>
                                    <Form.Field required>
                                        <label>Clusters File</label>
                                        <div>
                                            Please provide a .tsv or .csv file
                                            with two columns.
                                            <br />
                                            Column 1: Cell identifiers
                                            <br /> Column 2: Cluster identifiers
                                        </div>
                                    </Form.Field>
                                    <CSVReader
                                        accept='.csv,.tsv'
                                        parserOptions={{
                                            skipEmptyLines: true,
                                        }}
                                        onFileLoaded={(data, fileInfo) =>
                                            this.validateClusterData(
                                                data,
                                                fileInfo
                                            )
                                        }
                                    />
                                </CardContent>
                            </Card>
                        </Modal.Content>
                        <Modal.Actions>
                            {warningPopup(
                                <Button
                                    form='annoForm'
                                    type='submit'
                                    value='submit'
                                    onClick={(e) => this.sendData(e)}
                                    disabled={this.getButtonDisabledStatus()}
                                    primary>
                                    {this.getButtonText()}
                                </Button>
                            )}
                        </Modal.Actions>
                    </Modal>
                </React.Fragment>
            );
        };
        return clusteringModal();
    }
}
