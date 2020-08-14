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
import * as R from 'ramda';

import CSVReader from 'react-csv-reader';

declare const DEBUG: boolean;

interface ClusteringAddPopupProps {
    handleModalOpen: Function;
    handleModalClose: Function;
    orcid_name: string;
    orcid_id: string;
    orcid_uuid: string;
}

interface ClusteringAddPopupState {
    status: string;
    showModal: boolean;
    clusteringName: string;
    newclusterInfo?: {
        cellIDs: string[];
        clusterIDs: string[];
    };
}

export default class ClusteringAddPopup extends Component<
    ClusteringAddPopupProps,
    ClusteringAddPopupState
> {
    constructor(props: ClusteringAddPopupProps) {
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

    onClusteringNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ clusteringName: e.target.value });
    };

    validateClusterData = (data: Array<Array<string>>) => {
        const cols = new Set(
            data
                .map((x: Array<string>): number => x.length)
                .filter((n: number) => n > 0)
        );
        if (cols.size !== 1) {
            this.setState({ status: 'dataError' });
            alert(
                'Mismatched column lengths, please select a correctly formatted file!'
            );
        } else if (!cols.has(2)) {
            this.setState({ status: 'dataError' });
            alert(
                'Incorrect number of columns, please select a correctly formatted file!'
            );
        } else {
            const clusterInfo = R.transpose(data);
            this.setState({
                status: 'ready',
                newclusterInfo: {
                    cellIDs: clusterInfo[0],
                    clusterIDs: clusterInfo[1],
                },
            });
        }
    };

    sendData = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        if (this.state.clusteringName === '') {
            alert('You must enter a name for your clustering!');
            return;
        }
        const retVal = confirm(
            `Are you sure you want to add this new clustering?\n\n--> ${this.state.clusteringName} <--\n\nThis is a PERMANENT change!`
        );
        if (retVal === false) {
            return;
        }
        BackendAPI.getConnection().then((gbc) => {
            const query = {
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
            if (DEBUG) {
                console.debug('addNewClustering', query);
            }
            this.setState({ status: 'processing' }, () => {
                gbc.services.scope.Main.addNewClustering(
                    query,
                    (_, response) => {
                        this.setState({ status: 'ready' });
                        if (DEBUG) {
                            console.debug('addNewClustering', response);
                        }
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
        return !(
            'ready' === this.state.status &&
            this.state.newclusterInfo &&
            this.state.clusteringName !== ''
        );
    };

    getButtonText = () => {
        switch (this.state.status) {
            case 'ready':
                return (
                    <React.Fragment>
                        Submit Clustering... <Icon name='chevron right' />
                    </React.Fragment>
                );
            case 'processing':
                return (
                    <React.Fragment>
                        <Icon loading name='spinner' /> Processing
                    </React.Fragment>
                );
            case 'dataError':
                return 'Bad file!';
            default:
                return (
                    <React.Fragment>
                        Submit Clustering... <Icon name='chevron right' />
                    </React.Fragment>
                );
        }
    };

    render() {
        const { showModal, status } = this.state;

        const cardStyle = {
            display: 'block',
            width: '100vw',
            transitionDuration: '0.3s',
        };

        const warningPopup = (trigger) => {
            return (
                <Popup
                    trigger={trigger}
                    content='By submitting a new clustering, your ORCID details will be permanently added to this loom file. Anyone with access to this file will be able to see your full name and ORCID ID'
                />
            );
        };

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
                    id='clusteringAdd'>
                    <Modal.Header>Add Clustering</Modal.Header>
                    <Modal.Content scrolling>
                        <Divider horizontal>
                            <Header as='h4'>Basic Information</Header>
                        </Divider>
                        <Card style={cardStyle}>
                            <CardContent>
                                <Form.Field>
                                    <label>Clustering Group (Read Only)</label>
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
                                        onChange={this.onClusteringNameChange}
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
                                        Please provide a .tsv or .csv file with
                                        two columns.
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
                                    onFileLoaded={(
                                        data: Array<Array<string>>,
                                        fileInfo
                                    ) => this.validateClusterData(data)}
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
    }
}
