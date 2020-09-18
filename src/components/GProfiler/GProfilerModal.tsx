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
    displayModal: (display: boolean) => void;
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
    const {
        featureMetadata,
        display,
        displayModal,
        selectedSortBy,
        selectSortBy,
        selectedOrganism,
        selectOrganism,
        gProfilerToken,
        setGProfilerToken,
        selectedTopGeneListsSizes,
        setTopGeneListSizes,
        isFetchingAvailableOrganisms,
        availableOrganisms,
        fetchAvailableOrganisms,
        error,
        setError,
    } = props;

    const [availableSortBy, setAvailableSortBy] = useState<
        { key: number; text: string; value: string }[]
    >([]);
    const [featureMetricTable, setFeatureMetricTable] = useState<
        FeatureMetricTable
    >([]);

    useEffect(() => {
        setAvailableSortBy(getAvailableSortBy(featureMetadata));
        setFeatureMetricTable(getMetricTable(featureMetadata));
        fetchAvailableOrganisms();
    }, []);

    const onOpenModal = () => displayModal(true);

    const onCloseModal = () => displayModal(false);

    const onSelectSortBy = (
        _: React.ChangeEvent<HTMLInputElement>,
        { value }
    ) => selectSortBy(value);

    const onSelectOrganism = (
        _: React.ChangeEvent<HTMLInputElement>,
        { value }
    ) => selectOrganism(value);

    const onChangeToken = (_: React.ChangeEvent<HTMLInputElement>, { value }) =>
        setGProfilerToken(value);

    const onSelectGeneList = (geneListSize: number) => () => {
        if (selectedTopGeneListsSizes.includes(geneListSize)) {
            setTopGeneListSizes(
                selectedTopGeneListsSizes.filter(
                    (value) => value != geneListSize
                )
            );
        } else {
            setTopGeneListSizes([...selectedTopGeneListsSizes, geneListSize]);
        }
    };

    const onClickGotoGProfilerURL = async () => {
        const result = await checkCreateGProfilerLink({
            featureMetricTable,
            ...props,
        });
        if ('error' in result) {
            setError(result.error);
        }
        if ('link' in result && result.link !== '') {
            setError('');
            window.open(result.link);
        }
    };

    return (
        <Modal
            as={Form}
            trigger={
                <Button
                    color='orange'
                    onClick={onOpenModal}
                    className='gprofiler-run-gle'>
                    Run g:Profiler Gene List Enrichment
                </Button>
            }
            onClose={onCloseModal}
            open={display}>
            <Modal.Header>Run g:Profiler Gene List Enrichment</Modal.Header>
            <Modal.Content>
                {isFetchingAvailableOrganisms && (
                    <div style={{ marginBottom: '10px' }}>
                        <Label basic color='grey'>
                            {'Fetching available g:Profiler organisms...'}
                        </Label>
                    </div>
                )}
                {!isFetchingAvailableOrganisms &&
                    availableOrganisms.length == 0 && (
                        <>
                            <div style={{ marginBottom: '10px' }}>
                                <Label basic color='red'>
                                    {error}
                                </Label>
                            </div>
                            <Button
                                type='button'
                                value='refetch-available-organisms'
                                onClick={fetchAvailableOrganisms}
                                primary>
                                {'Try Again'}
                            </Button>
                        </>
                    )}
                {availableOrganisms.length > 0 && (
                    <>
                        <Modal.Description>
                            <h3>Run As Multi-query</h3>
                            <h4>
                                Total number of features:&nbsp;
                                {getNumFeatures(featureMetadata)}
                            </h4>
                            <Form>
                                <TopGeneListsSelectionTable
                                    availableTopGeneListsSizes={getAvailableTopGeneListsSizes(
                                        featureMetadata
                                    )}
                                    selectedTopGeneListsSizes={
                                        selectedTopGeneListsSizes
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
                                        value={selectedSortBy}
                                    />
                                    <Form.Field
                                        control={Dropdown}
                                        search
                                        selection
                                        label='Organism'
                                        options={availableOrganisms}
                                        placeholder='Choose an organism'
                                        onChange={onSelectOrganism}
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
                                        value={gProfilerToken}
                                        onChange={onChangeToken}
                                    />
                                </Form.Group>
                                {error !== '' && (
                                    <Form.Group>
                                        <Label basic color='red'>
                                            {error}
                                        </Label>
                                    </Form.Group>
                                )}
                            </Form>
                        </Modal.Description>
                    </>
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
        displayModal: (display: boolean) =>
            dispatch(Action.displayModal(display)),
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
