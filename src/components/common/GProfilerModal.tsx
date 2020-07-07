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
import { instanceOf } from 'prop-types';

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
    constructor(props: IGProfilerPopupProps & RouteComponentProps) {
        super(props);
        this.state = INITIAL_STATE;
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

    render() {
        const {
            showModal,
            topNumFeatures,
            selectedOrganism,
            gProfilerToken,
        } = this.state;
        const { clusteringID, clusterID } = this.props;

        const handleOpenModal = () => {
            this.openModal();
        };

        const handleCloseModal = () => {
            this.closeModal();
        };

        const topNumFeaturesArray = [
            this.props.numFeatures < 100 ? this.props.numFeatures : 100,
            200,
            300,
            400,
            500,
        ].filter((topNumFeaturesValue) =>
            topNumFeaturesValue <= this.props.numFeatures ? true : false
        );

        const handleClickCreateGProfilerLink = async () => {
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

        const organisms = [
            { key: 1, text: 'Human', value: 'hsapiens' },
            { key: 2, text: 'Mouse', value: 'mmusculus' },
            { key: 3, text: 'Drosophila melanogaster', value: 'dmelanogaster' },
        ];

        const handleSelectOrganism = (e, { value }) => {
            this.setState({ selectedOrganism: value, gProfilerURL: null });
        };

        const handleChangeToken = (e, { value }) => {
            this.setState({
                selectedOrganism: null,
                gProfilerToken: value,
                gProfilerURL: null,
            });
        };

        const handleClickGotoGProfilerURL = () => {
            window.open(this.state.gProfilerURL);
        };

        return (
            <>
                <Modal
                    as={Form}
                    trigger={
                        <Button
                            color='orange'
                            onClick={handleOpenModal}
                            style={{
                                marginTop: '10px',
                                marginBottom: '10px',
                                width: '100%',
                            }}>
                            Run g:Profiler Gene List Enrichment
                        </Button>
                    }
                    onClose={handleCloseModal}
                    // closeOnDocumentClick={'ready' == this.state.status}
                    open={showModal}
                    // onSubmit={e => {this.sendData(e)}}
                >
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
                                        {topNumFeaturesArray.map(
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
                                        options={organisms}
                                        placeholder='Choose an organism'
                                        onChange={handleSelectOrganism}
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
                                        onChange={handleChangeToken}
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
                                onClick={handleClickCreateGProfilerLink}
                                secondary>
                                {'Create Link'}
                            </Button>
                        ) : (
                            <Button
                                type='button'
                                value='goto-gprofiler'
                                onClick={handleClickGotoGProfilerURL}
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
