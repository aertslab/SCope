import * as R from 'ramda';
import React, { Component } from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import {
    Button,
    Modal,
    Form,
    Checkbox,
    Table,
    Input,
    Select,
    Label,
    Dropdown,
} from 'semantic-ui-react';

import { GPROFILER_API_ENDPOINT__AVAILABLE_ORGANISMS } from './constants';

import { buildMetricTable, checkCreateGProfilerLink } from './utils';

interface IGProfilerPopupState {
    error: string;
    showModal: boolean;
    selectedTopGeneListsSizes: number[];
    availableOrganisms: {
        display_name: string;
        id: string;
        scientific_name: string;
        version: string;
    }[];
    selectedOrganism: string;
    selectedSortBy: string;
    gProfilerToken: string;
}

interface IGProfilerPopupProps {
    featureMetadata: any;
    availableSortBy: object[];
}

const INITIAL_STATE = {
    error: '',
    showModal: false,
    /**
     * Array of number representing the top number of features to pick from the gene list
     * in order to create topNumFeautres.length gene lists that will be send to g:Profiler
     */
    selectedTopGeneListsSizes: [],
    availableOrganisms: [],
    selectedOrganism: '',
    selectedSortBy: '',
    gProfilerToken: '',
};

const TopGeneListsSelectionTable: React.FC<{
    topGeneListsSizes: number[];
    selectedTopGeneListsSizes: number[];
    onSelectGeneList: (geneListSize: number) => () => void;
}> = ({ topGeneListsSizes, selectedTopGeneListsSizes, onSelectGeneList }) => {
    return (
        <Table compact celled definition>
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell />
                    <Table.HeaderCell>
                        Gene List with Number of Top Features to Use
                    </Table.HeaderCell>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {topGeneListsSizes.map((topGeneListsSize) => {
                    const handleOnChangeGeneList = onSelectGeneList(
                        topGeneListsSize
                    );

                    const isSelected = selectedTopGeneListsSizes.includes(
                        topGeneListsSize
                    );

                    return (
                        <Table.Row key={`tgls-${topGeneListsSize}`}>
                            <Table.Cell collapsing>
                                <Checkbox onChange={handleOnChangeGeneList} />
                            </Table.Cell>
                            <Table.Cell>
                                {isSelected ? (
                                    <b>{`Top ${topGeneListsSize}`}</b>
                                ) : (
                                    <span
                                        style={{
                                            textDecorationLine: 'line-through',
                                            textDecorationStyle: 'solid',
                                        }}>{`Top ${topGeneListsSize}`}</span>
                                )}
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
};

class GProfilerPopup extends Component<
    IGProfilerPopupProps & RouteComponentProps,
    IGProfilerPopupState
> {
    featureMetadata: any;
    featureMetricTable: any;
    availableSortBy: object[];

    constructor(props: IGProfilerPopupProps & RouteComponentProps) {
        super(props);
        this.state = INITIAL_STATE;
        this.featureMetadata = props.featureMetadata;
        this.availableSortBy = props.featureMetadata.metrics.map(
            (metric, idx) => {
                return {
                    key: idx,
                    text: metric.name,
                    value: metric.accessor,
                };
            }
        );
        this.featureMetricTable = buildMetricTable(this.featureMetadata);
        this.onOpenModal.bind(this);
        this.onCloseModal.bind(this);
        this.onSelectOrganism.bind(this);
        this.onSelectSortBy.bind(this);
        this.onChangeToken.bind(this);
        this.onClickGotoGProfilerURL.bind(this);
    }

    openModal = () => {
        this.setState({
            error: '',
            selectedTopGeneListsSizes: [],
            selectedOrganism: '',
            selectedSortBy: '',
            gProfilerToken: '',
            showModal: true,
        });
    };

    closeModal = () => {
        this.setState({ showModal: false });
    };

    onOpenModal = () => {
        this.openModal();
    };

    onCloseModal = () => {
        this.closeModal();
    };

    onSelectGeneList = (geneListSize: number) => () => {
        if (this.state.selectedTopGeneListsSizes.includes(geneListSize)) {
            this.setState({
                selectedTopGeneListsSizes: this.state.selectedTopGeneListsSizes.filter(
                    (value) => value != geneListSize
                ),
            });
        } else {
            this.setState({
                selectedTopGeneListsSizes: [
                    ...this.state.selectedTopGeneListsSizes,
                    geneListSize,
                ],
            });
        }
    };

    onSelectOrganism = (e, { value }) => {
        this.setState({ selectedOrganism: value });
    };

    onSelectSortBy = (e, { value }) => {
        this.setState({ selectedSortBy: value });
    };

    onChangeToken = (e, { value }) => {
        this.setState({
            selectedOrganism: '',
            gProfilerToken: value,
        });
    };

    onClickGotoGProfilerURL = async () => {
        const result = await checkCreateGProfilerLink({
            featureMetricTable: this.featureMetricTable,
            ...this.state,
        });
        if ('error' in result) this.setState({ error: result.error });

        if (result.link === '' || typeof result.link !== 'string') return;
        window.open(result.link);
    };

    getNumFeatures = () => {
        return this.featureMetadata.genes.length;
    };

    getAvailableTopGeneListsSizes = () => {
        return [
            this.getNumFeatures() < 100 ? this.getNumFeatures() : 100,
            200,
            300,
            400,
            500,
        ].filter((topNumFeaturesValue) =>
            topNumFeaturesValue <= this.getNumFeatures() ? true : false
        );
    };

    setAvailableOrganisms(availableOrganisms) {
        const _availableOrganisms = availableOrganisms
            .map((availableOrganism, idx: number) => {
                return {
                    key: idx + 1,
                    text: availableOrganism['display_name'],
                    value: availableOrganism['id'],
                };
            })
            .sort(R.comparator((a, b) => a['text'] < b['text']));
        this.setState({ availableOrganisms: _availableOrganisms });
    }

    async fetchAvailableOrganisms() {
        let response = null;
        try {
            response = await fetch(GPROFILER_API_ENDPOINT__AVAILABLE_ORGANISMS);
            return response.json();
        } catch (err) {
            this.setState({
                error: `Unable to fetch list of organisms: ${err}`,
            });
        }
        return response;
    }

    async componentDidMount() {
        const availableOrganisms = await this.fetchAvailableOrganisms();
        if (availableOrganisms !== null)
            this.setAvailableOrganisms(availableOrganisms);
    }

    render() {
        const {
            showModal,
            selectedOrganism,
            selectedSortBy,
            gProfilerToken,
        } = this.state;

        return (
            <Modal
                as={Form}
                trigger={
                    <Button
                        color='orange'
                        onClick={this.onOpenModal}
                        style={{
                            marginTop: '10px',
                            marginBottom: '10px',
                            width: '100%',
                        }}>
                        Run g:Profiler Gene List Enrichment
                    </Button>
                }
                onClose={this.onCloseModal}
                open={showModal}>
                <Modal.Header>Run g:Profiler Gene List Enrichment</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <h3>Run As Multi-query</h3>
                        <h4>
                            Total number of features:&nbsp;
                            {this.getNumFeatures()}
                        </h4>
                        <Form>
                            <TopGeneListsSelectionTable
                                topGeneListsSizes={this.getAvailableTopGeneListsSizes()}
                                selectedTopGeneListsSizes={
                                    this.state.selectedTopGeneListsSizes
                                }
                                onSelectGeneList={this.onSelectGeneList}
                            />
                            <Form.Group widths='equal'>
                                <Form.Field
                                    control={Select}
                                    label='Sort Features By'
                                    options={this.availableSortBy}
                                    placeholder='Sort By'
                                    onChange={this.onSelectSortBy}
                                    value={selectedSortBy}
                                />
                                <Form.Field
                                    control={Dropdown}
                                    search
                                    selection
                                    label='Organism'
                                    options={this.state.availableOrganisms}
                                    placeholder='Choose an organism'
                                    onChange={this.onSelectOrganism}
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
                                    onChange={this.onChangeToken}
                                />
                            </Form.Group>
                            {this.state.error !== '' && (
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
                    <Button
                        type='button'
                        value='goto-gprofiler'
                        onClick={this.onClickGotoGProfilerURL}
                        primary>
                        {'Go to g:Profiler'}
                    </Button>
                </Modal.Actions>
            </Modal>
        );
    }
}

export default withRouter(GProfilerPopup);
