import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import {
    Button,
    Modal,
    Form,
    Input,
    Select,
    Label,
    Dropdown,
    DropdownItemProps,
} from 'semantic-ui-react';
import * as R from 'ramda';

import { TopGeneListsSelectionTable } from './TopGeneListsSelectionTable';

import './GProfilerModal.css';

import * as Action from './actions';
import * as Selector from './selectors';

import {
    getNumFeatures,
    getAvailableTopGeneListsSizes,
    getMetricTable,
    getAvailableSortBy,
} from './model';

import { checkCreateGProfilerLink } from './link';

import {
    GProfilerOrganism,
    FeatureMetadata,
    FeatureMetricTable,
} from './model';

interface GProfilerPopupProps {
    featureMetadata: FeatureMetadata;
}

class GProfilerPopup extends React.Component<
    GProfilerModalProps & RouteComponentProps
> {
    featureMetricTable: FeatureMetricTable;
    availableSortBy: { key: number; text: string; value: string }[];

    constructor(props) {
        super(props);
        this.availableSortBy = getAvailableSortBy(props.featureMetadata);
        this.featureMetricTable = getMetricTable(props.featureMetadata);
    }

    componentDidMount() {
        this.props.fetchAvailableOrganisms();
    }

    onSelectSortBy = (_: React.ChangeEvent<HTMLInputElement>, { value }) =>
        this.props.selectSortBy(value);

    onSelectOrganism = (_: React.ChangeEvent<HTMLInputElement>, { value }) =>
        this.props.selectOrganism(value);

    onChangeToken = (_: React.ChangeEvent<HTMLInputElement>, { value }) =>
        this.props.setGProfilerToken(value);

    onSelectGeneList = (geneListSize: number) => () => {
        if (this.props.selectedTopGeneListsSizes.includes(geneListSize)) {
            this.props.setTopGeneListSizes(
                this.props.selectedTopGeneListsSizes.filter(
                    (value) => value !== geneListSize
                )
            );
        } else {
            this.props.setTopGeneListSizes([
                ...this.props.selectedTopGeneListsSizes,
                geneListSize,
            ]);
        }
    };

    onClickGotoGProfilerURL = () => {
        const result = checkCreateGProfilerLink({
            featureMetricTable: this.featureMetricTable,
            ...this.props,
        });
        if (result.error) {
            this.props.setError(result.error);
        }
        if (result.link && result.link !== '') {
            this.props.setError('');
            window.open(result.link);
        }
    };

    private organismsToFormField(
        organisms: GProfilerOrganism[]
    ): DropdownItemProps[] {
        return organisms
            .map((organism, key) => {
                return {
                    key,
                    text: organism.display_name,
                    value: organism.id,
                };
            })
            .sort(R.comparator((a, b) => a.text < b.text));
    }

    render() {
        return (
            <Modal
                as={Form}
                trigger={
                    <Button
                        color='orange'
                        onClick={this.props.toggleModal}
                        className='gprofilerRunGLE'>
                        Run g:Profiler Gene List Enrichment
                    </Button>
                }
                onClose={this.props.toggleModal}
                open={this.props.isDisplayed}>
                <Modal.Header>Run g:Profiler Gene List Enrichment</Modal.Header>
                <Modal.Content>
                    {this.props.isFetchingAvailableOrganisms && (
                        <div style={{ marginBottom: '10px' }}>
                            <Label basic color='grey'>
                                {'Fetching available g:Profiler organisms...'}
                            </Label>
                        </div>
                    )}
                    {!this.props.isFetchingAvailableOrganisms &&
                        this.props.availableOrganisms.length === 0 && (
                            <React.Fragment>
                                <div style={{ marginBottom: '10px' }}>
                                    <Label basic color='red'>
                                        {this.props.error}
                                    </Label>
                                </div>
                                <Button
                                    type='button'
                                    value='refetch-available-organisms'
                                    onClick={this.props.fetchAvailableOrganisms}
                                    primary>
                                    {'Try Again'}
                                </Button>
                            </React.Fragment>
                        )}
                    {this.props.availableOrganisms.length > 0 && (
                        <React.Fragment>
                            <Modal.Description>
                                <h3>Run As Multi-query</h3>
                                <h4>
                                    Total number of features:&nbsp;
                                    {getNumFeatures(this.props.featureMetadata)}
                                </h4>
                                <Form>
                                    <TopGeneListsSelectionTable
                                        availableTopGeneListsSizes={getAvailableTopGeneListsSizes(
                                            this.props.featureMetadata
                                        )}
                                        selectedTopGeneListsSizes={
                                            this.props.selectedTopGeneListsSizes
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
                                            value={this.props.selectedSortBy}
                                        />
                                        <Form.Field
                                            control={Dropdown}
                                            search
                                            selection
                                            label='Organism'
                                            options={this.organismsToFormField(
                                                this.props.availableOrganisms
                                            )}
                                            placeholder='Choose an organism'
                                            onChange={this.onSelectOrganism}
                                            disabled={
                                                this.props.gProfilerToken !==
                                                    null &&
                                                this.props.gProfilerToken !== ''
                                                    ? true
                                                    : false
                                            }
                                            value={this.props.selectedOrganism}
                                        />
                                        <Form.Field
                                            control={Input}
                                            label='g:Profiler Token (Optional)'
                                            placeholder='Token'
                                            value={this.props.gProfilerToken}
                                            onChange={this.onChangeToken}
                                        />
                                    </Form.Group>
                                    {this.props.error !== '' && (
                                        <Form.Group>
                                            <Label basic color='red'>
                                                {this.props.error}
                                            </Label>
                                        </Form.Group>
                                    )}
                                </Form>
                            </Modal.Description>
                        </React.Fragment>
                    )}
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

const mapStateToProps = (state) => {
    return {
        isDisplayed: Selector.isDisplayed(state),
        selectedOrganism: Selector.getSelectedOrganism(state),
        selectedSortBy: Selector.getSelectedSortBy(state),
        gProfilerToken: Selector.getGProfilerToken(state),
        isFetchingAvailableOrganisms:
            Selector.isFetchingAvailableOrganisms(state),
        availableOrganisms: Selector.getAvailableOrganisms(state),
        selectedTopGeneListsSizes: Selector.getSelectedTopGeneListsSizes(state),
        error: Selector.getError(state),
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        toggleModal: (): void => dispatch(Action.toggleModal()),
        selectSortBy: (sortBy: string) => dispatch(Action.selectSortBy(sortBy)),
        selectOrganism: (organism: string) =>
            dispatch(Action.selectOrganism(organism)),
        setGProfilerToken: (token: string) =>
            dispatch(Action.setGProfilerToken(token)),
        setTopGeneListSizes: (topGeneListSizes: number[]) =>
            dispatch(Action.setTopGeneListSizes(topGeneListSizes)),
        fetchAvailableOrganisms: () =>
            dispatch(Action.fetchAvailableOrganisms()),
        setError: (error: string) => dispatch(Action.setError(error)),
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps);

type PropsFromRedux = ConnectedProps<typeof Container>;

export type GProfilerModalProps = PropsFromRedux & GProfilerPopupProps;

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(withRouter(GProfilerPopup));