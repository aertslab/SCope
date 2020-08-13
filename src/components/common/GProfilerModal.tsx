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
    Dropdown,
} from 'semantic-ui-react';

interface IGProfilerPopupState {
    error: string;
    showModal: boolean;
    topNumFeatures: number[];
    availableOrganisms: object[];
    selectedOrganism: string;
    selectedSortBy: string;
    gProfilerToken: string;
    gProfilerURL: string;
}

interface IGProfilerPopupProps {
    featureMetadata: any;
    availableSortBy: object[];
}

const INITIAL_STATE = {
    error: null,
    showModal: false,
    topNumFeatures: [],
    availableOrganisms: [],
    selectedOrganism: null,
    selectedSortBy: null,
    gProfilerToken: null,
    gProfilerURL: null,
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
        this.handleOpenModal.bind(this);
        this.handleCloseModal.bind(this);
        this.handleSelectOrganism.bind(this);
        this.handleSelectSortBy.bind(this);
        this.handleChangeToken.bind(this);
        this.handleClickGotoGProfilerURL.bind(this);
    }

    openModal = () => {
        const { availableOrganisms, ...rest } = INITIAL_STATE;
        this.setState({
            ...rest,
            showModal: true,
        });
    };

    closeModal = () => {
        this.setState({ showModal: false });
    };

    handleOpenModal = () => {
        console.log(this.state);
        this.openModal();
    };

    handleCloseModal = () => {
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
        this.setState({ selectedOrganism: value, gProfilerURL: null });
    };

    handleSelectSortBy = (e, { value }) => {
        this.setState({ selectedSortBy: value, gProfilerURL: null });
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

        var gProfilerQueryString = Object.keys(gProfilerQueryData)
            .map((key) => {
                return (
                    encodeURIComponent(key) +
                    '=' +
                    encodeURIComponent(gProfilerQueryData[key])
                );
            })
            .join('&');

        return 'https://biit.cs.ut.ee/gprofiler/gost?' + gProfilerQueryString;
    };

    handleClickCreateGProfilerLink = async () => {
        const {
            topNumFeatures,
            gProfilerToken,
            selectedOrganism,
            selectedSortBy,
        } = this.state;
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
        if (gProfilerLink.length > 8000) {
            this.setState({
                error:
                    'Too many genes in total. Try to select a combination of gene lists with fewer genes.',
                gProfilerURL: null,
            });
            return;
        }
        this.setState({
            gProfilerURL: gProfilerLink,
        });
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
            .sort((a, b) => (a['text'] < b['text'] ? -1 : 1));
        this.setState({ availableOrganisms: _availableOrganisms });
    }

    async fetchAvailableOrganisms() {
        const response = await fetch(
            'https://biit.cs.ut.ee/gprofiler/api/util/organisms_list/'
        );
        return await response.json();
    }

    async componentDidMount() {
        const availableOrganisms = await this.fetchAvailableOrganisms();
        this.setAvailableOrganisms(availableOrganisms);
    }

    render() {
        const {
            showModal,
            selectedOrganism,
            selectedSortBy,
            gProfilerToken,
        } = this.state;

        console.log(this.state);

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
                                {this.getNumFeatures()}
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
