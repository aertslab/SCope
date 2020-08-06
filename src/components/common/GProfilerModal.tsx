import { BackendAPI } from './API';
import { withRouter, RouteComponentProps } from 'react-router-dom';

import React, { Component } from 'react';
import {
    Button,
    Modal,
    Form,
    Checkbox,
    Table,
    Input,
    Select,
    Label,
} from 'semantic-ui-react';

interface IGProfilerPopupState {
    error: string;
    showModal: boolean;
    topNumFeatures: number[];
    selectedOrganism: string;
    gProfilerToken: string;
    gProfilerURL: string;
}

interface IGProfilerPopupProps {
    numFeatures: number;
    clusteringID: number;
    clusterID: number;
}

const GPROFILER_AVAILABLE_ORGANISMS = [
    { key: 1, text: 'Human', value: 'hsapiens' },
    { key: 2, text: 'Mouse', value: 'mmusculus' },
    { key: 3, text: 'Drosophila melanogaster', value: 'dmelanogaster' },
];

const INITIAL_STATE = {
    error: null,
    showModal: false,
    topNumFeatures: [],
    selectedOrganism: null,
    gProfilerToken: null,
    gProfilerURL: null,
};

class GProfilerPopup extends Component<
    IGProfilerPopupProps & RouteComponentProps,
    IGProfilerPopupState
> {
    clusteringID: number;
    clusterID: number;

    constructor(props: IGProfilerPopupProps & RouteComponentProps) {
        super(props);
        this.state = INITIAL_STATE;
        this.handleOpenModal.bind(this);
        this.handleCloseModal.bind(this);
        this.handleSelectOrganism.bind(this);
        this.handleChangeToken.bind(this);
        this.handleClickGotoGProfilerURL.bind(this);
    }

    openModal = () => {
        this.setState({
            ...INITIAL_STATE,
            showModal: true,
        });
    };

    closeModal = () => {
        this.setState({ showModal: false });
    };

    handleOpenModal = () => {
        this.openModal();
    };

    handleCloseModal = () => {
        this.closeModal();
    };

    getTopNumFeaturesArray = () => {
        return [
            this.props.numFeatures < 100 ? this.props.numFeatures : 100,
            200,
            300,
            400,
            500,
        ].filter((topNumFeaturesValue) =>
            topNumFeaturesValue <= this.props.numFeatures ? true : false
        );
    };

    handleSelectOrganism = (e, { value }) => {
        this.setState({ selectedOrganism: value, gProfilerURL: null });
    };

    handleChangeToken = (e, { value }) => {
        this.setState({
            selectedOrganism: null,
            gProfilerToken: value,
            gProfilerURL: null,
        });
    };

    handleClickGotoGProfilerURL = () => {
        window.open(this.state.gProfilerURL);
    };

    handleClickCreateGProfilerLink = async () => {
        const { topNumFeatures, gProfilerToken, selectedOrganism } = this.state;
        const { clusteringID, clusterID } = this.props;
        if (
            (gProfilerToken === null || gProfilerToken === '') &&
            selectedOrganism === null
        ) {
            this.setState({
                error: 'Please select an organism',
                gProfilerURL: null,
            });
            return;
        }
        if (topNumFeatures.length == 0) {
            this.setState({
                error:
                    'No gene list selected. One gene list is at least required. ',
                gProfilerURL: null,
            });
            return;
        }

        if (topNumFeatures.length == 0) {
            this.setState({
                error:
                    'No gene list selected. One gene list is at least required. ',
                gProfilerURL: null,
            });
            return;
        }

        const gProfilerLinkResponse = await BackendAPI.getGProfilerLink(
            clusteringID,
            clusterID,
            topNumFeatures,
            selectedOrganism,
            gProfilerToken
        );

        if (gProfilerLinkResponse.url.length > 8000) {
            this.setState({
                error:
                    'Too many genes in total. Try to select a combination of gene lists with fewer genes.',
                gProfilerURL: null,
            });
            return;
        }

        this.setState({
            gProfilerURL: gProfilerLinkResponse.url,
        });
    };

    render() {
        const { showModal, selectedOrganism, gProfilerToken } = this.state;

        return (
            <>
                <Modal
                    as={Form}
                    trigger={
                        <Button
                            color='orange'
                            onClick={this.handleOpenModal}
                            style={{
                                marginTop: '10px',
                                marginBottom: '10px',
                                width: '100%',
                            }}>
                            Run g:Profiler Gene List Enrichment
                        </Button>
                    }
                    onClose={this.handleCloseModal}
                    open={showModal}>
                    <Modal.Header>
                        Run g:Profiler Gene List Enrichment
                    </Modal.Header>
                    <Modal.Content>
                        <Modal.Description>
                            <h3>Run As Multi-query</h3>
                            <h4>
                                Total number of features:&nbsp;
                                {this.props.numFeatures}
                            </h4>
                            <Form>
                                <Table compact celled definition>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.HeaderCell />
                                            <Table.HeaderCell>
                                                Gene List with Number of Top
                                                Features to Use
                                            </Table.HeaderCell>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {this.getTopNumFeaturesArray().map(
                                            (topNumFeaturesValue) => {
                                                const handleToggleTopNumFeatures = () => {
                                                    if (
                                                        this.state.topNumFeatures.includes(
                                                            topNumFeaturesValue
                                                        )
                                                    ) {
                                                        this.setState({
                                                            topNumFeatures: this.state.topNumFeatures.filter(
                                                                (value) =>
                                                                    value !=
                                                                    topNumFeaturesValue
                                                            ),
                                                            gProfilerURL: null,
                                                        });
                                                    } else {
                                                        this.setState({
                                                            topNumFeatures: [
                                                                ...this.state
                                                                    .topNumFeatures,
                                                                topNumFeaturesValue,
                                                            ],
                                                            gProfilerURL: null,
                                                        });
                                                    }
                                                };

                                                const isSelected = this.state.topNumFeatures.includes(
                                                    topNumFeaturesValue
                                                );

                                                return (
                                                    <Table.Row>
                                                        <Table.Cell collapsing>
                                                            <Checkbox
                                                                onChange={
                                                                    handleToggleTopNumFeatures
                                                                }
                                                            />
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            {isSelected ? (
                                                                <b>
                                                                    {`Top ${topNumFeaturesValue}`}
                                                                </b>
                                                            ) : (
                                                                <span
                                                                    style={{
                                                                        textDecorationLine:
                                                                            'line-through',
                                                                        textDecorationStyle:
                                                                            'solid',
                                                                    }}>{`Top ${topNumFeaturesValue}`}</span>
                                                            )}
                                                        </Table.Cell>
                                                    </Table.Row>
                                                );
                                            }
                                        )}
                                    </Table.Body>
                                </Table>
                                <Form.Group widths='equal'>
                                    <Form.Field
                                        control={Select}
                                        label='Organism'
                                        options={GPROFILER_AVAILABLE_ORGANISMS}
                                        placeholder='Choose an organism'
                                        onChange={this.handleSelectOrganism}
                                        disabled={
                                            gProfilerToken !== null &&
                                            gProfilerToken !== ''
                                                ? true
                                                : false
                                        }
                                        value={selectedOrganism}
                                    />
                                    <Form.Field
                                        control={Input}
                                        label='g:Profiler Token (Optional)'
                                        placeholder='Token'
                                        value={this.state.gProfilerToken}
                                        onChange={this.handleChangeToken}
                                    />
                                </Form.Group>
                                {this.state.error !== null && (
                                    <Form.Group>
                                        <Label basic color='red'>
                                            {this.state.error}
                                        </Label>
                                    </Form.Group>
                                )}
                            </Form>
                        </Modal.Description>
                    </Modal.Content>
                    <Modal.Actions>
                        {this.state.gProfilerURL == null ? (
                            <Button
                                type='button'
                                value='create-gprofiler-link'
                                onClick={this.handleClickCreateGProfilerLink}
                                secondary>
                                {'Create Link'}
                            </Button>
                        ) : (
                            <Button
                                type='button'
                                value='goto-gprofiler'
                                onClick={this.handleClickGotoGProfilerURL}
                                primary>
                                {'Go to g:Profiler'}
                            </Button>
                        )}
                    </Modal.Actions>
                </Modal>
            </>
        );
    }
}

export default withRouter(GProfilerPopup);
