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

import {
    GPROFILER_API_ENDPOINT__AVAILABLE_ORGANISMS,
    GPROFILER_API_ENDPOINT__GENE_LIST_FUNCTIONAL_ENRICHMENT,
    GPROFILER_LINK_MAX_LENGTH,
} from './constants';

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
        this.featureMetricTable = this.buildMetricTable();
        this.onOpenModal.bind(this);
        this.onCloseModal.bind(this);
        this.handleSelectOrganism.bind(this);
        this.handleSelectSortBy.bind(this);
        this.handleChangeToken.bind(this);
        this.handleClickGotoGProfilerURL.bind(this);
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

    getNumFeatures = () => {
        return this.featureMetadata.genes.length;
    };

    getTopNumFeaturesArray = () => {
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

    handleSelectOrganism = (e, { value }) => {
        this.setState({ selectedOrganism: value });
    };

    handleSelectSortBy = (e, { value }) => {
        this.setState({ selectedSortBy: value });
    };

    handleChangeToken = (e, { value }) => {
        this.setState({
            selectedOrganism: '',
            gProfilerToken: value,
        });
    };

    handleClickGotoGProfilerURL = async () => {
        const gProfilerLink = await this.handleClickCreateGProfilerLink();
        if (gProfilerLink === '' || typeof gProfilerLink !== 'string') return;
        window.open(gProfilerLink);
    };

    buildMetricTable = () => {
        return this.featureMetadata.genes.map((gene: string, idx: number) => {
            return {
                gene: gene,
                ...this.featureMetadata.metrics.reduce(
                    (accumalatedMetrics, metric) => ({
                        ...accumalatedMetrics,
                        [metric.accessor]: metric.values[idx],
                    }),
                    {}
                ),
            };
        });
    };

    buildFeatureQuery = (topNumFeatures, sortedFeatureMetricTable) => {
        return topNumFeatures
            .map((topNumFeaturesElement) => {
                return {
                    numFeatures: topNumFeaturesElement,
                    topSortedFeatures: sortedFeatureMetricTable
                        .slice(0, topNumFeaturesElement)
                        .reduce(
                            (acc, sortedFeatureMetricTableRow) => [
                                ...acc,
                                sortedFeatureMetricTableRow['gene'],
                            ],
                            []
                        )
                        .join('\n'),
                };
            })
            .reduce((acc, el) => {
                return (
                    acc +
                    `>Top_${el.numFeatures}` +
                    '\n' +
                    el.topSortedFeatures +
                    '\n'
                );
            }, '');
    };

    buildGProfilerLink = (organism: string, query: string) => {
        const gProfilerQueryData = {
            organism: organism,
            query: query,
            ordered: 'true',
            all_results: 'false',
            no_iea: 'false',
            combined: 'true',
            measure_underrepresentation: 'false',
            domain_scope: 'annotated',
            significance_threshold_method: 'g_SCS',
            user_threshold: '0.05',
            numeric_namespace: 'ENTREZGENE_ACC',
            sources: 'GO:MF,GO:CC,GO:BP,KEGG,TF,REAC,MIRNA,HPA,CORUM,HP,WP',
            background: '',
        };

        const gProfilerQueryString = Object.keys(gProfilerQueryData)
            .map((key) => {
                return (
                    encodeURIComponent(key) +
                    '=' +
                    encodeURIComponent(gProfilerQueryData[key])
                );
            })
            .join('&');

        return `${GPROFILER_API_ENDPOINT__GENE_LIST_FUNCTIONAL_ENRICHMENT}?${gProfilerQueryString}`;
    };

    handleClickCreateGProfilerLink = async () => {
        const {
            topNumFeatures,
            gProfilerToken,
            selectedOrganism,
            selectedSortBy,
        } = this.state;
        if (selectedSortBy === '') {
            this.setState({
                error: 'Please select a sort column',
            });
            return null;
        }
        if (gProfilerToken === '' && selectedOrganism === '') {
            this.setState({
                error: 'Please select an organism',
            });
            return null;
        }

        if (topNumFeatures.length == 0) {
            this.setState({
                error:
                    'No gene list selected. At least one gene list is required.',
            });
            return null;
        }
        if (topNumFeatures.length == 0) {
            this.setState({
                error:
                    'No gene list selected. At least one gene list is required.',
            });
            return null;
        }

        const sortedFeatureMetricTable = this.featureMetricTable.sort(
            (a, b) => b[selectedSortBy] - a[selectedSortBy]
        );
        const topFeatureQuery = this.buildFeatureQuery(
            topNumFeatures,
            sortedFeatureMetricTable
        );
        const organism =
            gProfilerToken !== null ? gProfilerToken : selectedOrganism;
        const gProfilerLink = this.buildGProfilerLink(
            organism,
            topFeatureQuery
        );
        if (gProfilerLink.length > GPROFILER_LINK_MAX_LENGTH) {
            this.setState({
                error:
                    'Too many genes in total. Try to select a combination of gene lists with fewer genes.',
            });
            return null;
        }
        return gProfilerLink;
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
                                    onChange={this.handleSelectSortBy}
                                    value={selectedSortBy}
                                />
                                <Form.Field
                                    control={Dropdown}
                                    search
                                    selection
                                    label='Organism'
                                    options={this.state.availableOrganisms}
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
                        onClick={this.handleClickGotoGProfilerURL}
                        primary>
                        {'Go to g:Profiler'}
                    </Button>
                </Modal.Actions>
            </Modal>
        );
    }
}

export default withRouter(GProfilerPopup);
