import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import {
    Button,
    Modal,
    Form,
    Input,
    Select,
    Label,
    Dropdown,
} from 'semantic-ui-react';

import { TopGeneListsSelectionTable } from './TopGeneListsSelectionTable';

import 'GProfilerModal.css';

import * as Action from './actions';
import * as Selector from './selectors';

import {
    getNumFeatures,
    getAvailableTopGeneListsSizes,
    getMetricTable,
    getAvailableSortBy,
    checkCreateGProfilerLink,
} from './utils';
import {
    GProfilerOrganism,
    FeatureMetadata,
    FeatureMetricTable,
} from './types';

interface GProfilerPopupProps {
    featureMetadata: FeatureMetadata;
    availableSortBy: object[];
}

interface GProfilerPopupReduxProps {
    display: boolean;
    toggleModal: () => void;
    selectedSortBy: string;
    selectSortBy: (sortBy: string) => void;
    selectedOrganism: string;
    selectOrganism: (organism: string) => void;
    gProfilerToken: string;
    setGProfilerToken: (gProfilerToken: string) => void;
    selectedTopGeneListsSizes: number[];
    setTopGeneListSizes: (topGeneListSizes: number[]) => void;
    availableOrganisms: GProfilerOrganism[];
    isFetchingAvailableOrganisms: boolean;
    fetchAvailableOrganisms: () => void;
    error: string;
    setError: (error: string) => void;
}

const GProfilerPopup: React.FC<
    GProfilerPopupProps & GProfilerPopupReduxProps & RouteComponentProps
> = (props) => {
    const [availableSortBy, setAvailableSortBy] = useState<
        { key: number; text: string; value: string }[]
    >([]);
    const [featureMetricTable, setFeatureMetricTable] = useState<
        FeatureMetricTable
    >([]);

    useEffect(() => {
        setAvailableSortBy(getAvailableSortBy(props.featureMetadata));
        setFeatureMetricTable(getMetricTable(props.featureMetadata));
        props.fetchAvailableOrganisms();
    }, []);

    const onSelectSortBy = (
        _: React.ChangeEvent<HTMLInputElement>,
        { value }
    ) => props.selectSortBy(value);

    const onSelectOrganism = (
        _: React.ChangeEvent<HTMLInputElement>,
        { value }
    ) => props.selectOrganism(value);

    const onChangeToken = (_: React.ChangeEvent<HTMLInputElement>, { value }) =>
        props.setGProfilerToken(value);

    const onSelectGeneList = (geneListSize: number) => () => {
        if (props.selectedTopGeneListsSizes.includes(geneListSize)) {
            props.setTopGeneListSizes(
                props.selectedTopGeneListsSizes.filter(
                    (value) => value != geneListSize
                )
            );
        } else {
            props.setTopGeneListSizes([
                ...props.selectedTopGeneListsSizes,
                geneListSize,
            ]);
        }
    };

    const onClickGotoGProfilerURL = async () => {
        const result = await checkCreateGProfilerLink({
            featureMetricTable,
            ...props,
        });
        if ('error' in result) {
            props.setError(result.error);
        }
        if ('link' in result && result.link !== '') {
            props.setError('');
            window.open(result.link);
        }
    };

    return (
        <Modal
            as={Form}
            trigger={
                <Button
                    color='orange'
                    onClick={props.toggleModal}
                    className='gprofiler-run-gle'>
                    Run g:Profiler Gene List Enrichment
                </Button>
            }
            onClose={props.toggleModal}
            open={props.display}>
            <Modal.Header>Run g:Profiler Gene List Enrichment</Modal.Header>
            <Modal.Content>
                {props.isFetchingAvailableOrganisms && (
                    <div style={{ marginBottom: '10px' }}>
                        <Label basic color='grey'>
                            {'Fetching available g:Profiler organisms...'}
                        </Label>
                    </div>
                )}
                {!props.isFetchingAvailableOrganisms &&
                    props.availableOrganisms.length === 0 && (
                        <React.Fragment>
                            <div style={{ marginBottom: '10px' }}>
                                <Label basic color='red'>
                                    {props.error}
                                </Label>
                            </div>
                            <Button
                                type='button'
                                value='refetch-available-organisms'
                                onClick={props.fetchAvailableOrganisms}
                                primary>
                                {'Try Again'}
                            </Button>
                        </React.Fragment>
                    )}
                {props.availableOrganisms.length > 0 && (
                    <React.Fragment>
                        <Modal.Description>
                            <h3>Run As Multi-query</h3>
                            <h4>
                                Total number of features:&nbsp;
                                {getNumFeatures(props.featureMetadata)}
                            </h4>
                            <Form>
                                <TopGeneListsSelectionTable
                                    availableTopGeneListsSizes={getAvailableTopGeneListsSizes(
                                        props.featureMetadata
                                    )}
                                    selectedTopGeneListsSizes={
                                        props.selectedTopGeneListsSizes
                                    }
                                    onSelectGeneList={onSelectGeneList}
                                />
                                <Form.Group widths='equal'>
                                    <Form.Field
                                        control={Select}
                                        label='Sort Features By'
                                        options={availableSortBy}
                                        placeholder='Sort By'
                                        onChange={onSelectSortBy}
                                        value={props.selectedSortBy}
                                    />
                                    <Form.Field
                                        control={Dropdown}
                                        search
                                        selection
                                        label='Organism'
                                        options={props.availableOrganisms}
                                        placeholder='Choose an organism'
                                        onChange={onSelectOrganism}
                                        disabled={
                                            props.gProfilerToken !== null &&
                                            props.gProfilerToken !== ''
                                                ? true
                                                : false
                                        }
                                        value={props.selectedOrganism}
                                    />
                                    <Form.Field
                                        control={Input}
                                        label='g:Profiler Token (Optional)'
                                        placeholder='Token'
                                        value={props.gProfilerToken}
                                        onChange={onChangeToken}
                                    />
                                </Form.Group>
                                {props.error !== '' && (
                                    <Form.Group>
                                        <Label basic color='red'>
                                            {props.error}
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
                    onClick={onClickGotoGProfilerURL}
                    primary>
                    {'Go to g:Profiler'}
                </Button>
            </Modal.Actions>
        </Modal>
    );
};

const mapStateToProps = (state) => {
    return {
        isDisplayed: Selector.isDisplayed(state),
        selectedOrganism: Selector.getSelectedOrganism(state),
        selectedSortBy: Selector.getSelectedSortBy(state),
        gProfilerToken: Selector.getGProfilerToken(state),
        isFetchingAvailableOrganisms: Selector.isFetchingAvailableOrganisms(
            state
        ),
        availableOrganisms: Selector.getAvailableOrganisms(state),
        selectedTopGeneListsSizes: Selector.getSelectedTopGeneListsSizes(state),
        error: Selector.getError(state),
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        toggleModal: (display: boolean) => dispatch(Action.toggleModal()),
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

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(withRouter(GProfilerPopup));
