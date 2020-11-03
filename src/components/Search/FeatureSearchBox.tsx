import React, { Component, ComponentClass } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Segment,
    Search,
    SearchProps,
    SearchResultsProps,
    StrictSearchCategoryProps,
    Select,
    SemanticCOLORS,
} from 'semantic-ui-react';
import * as R from 'ramda';

import { RootState } from '../../redux/reducers';
import { Features, LegacyAPI } from '../../api';

import {
    FeatureSearch,
    FeatureFilter,
    FeatureSearchSelection,
    featuresToResults,
    findResult,
    init,
    orderCategories,
} from './model';
import * as Action from './actions';
import * as Selector from './selectors';
import { NAME } from './constants';

import './FeatureSearchBox.css';

// TODO: Remove this when removing the LegacyAPI code
declare const __TEST_ONLY__: boolean;

type FeatureSearchBoxProps = {
    /** A unique identifier */
    field: string;

    /** The feature type to search for */
    filter: FeatureFilter;

    /** Background colour */
    colour: string;
};

type FeatureSearchBoxState = {
    /** A search result has been selected */
    selected: FeatureSearchSelection | undefined;

    /** Show a loading indication */
    loading: boolean;

    /** Text to display in the input */
    value: string;

    /** Search results */
    results: readonly Features[];
};

/**
 * A text search input for items in a dataset.
 */
export const FeatureSearchBox = (props: FeatureSearchBoxProps) => {
    const legacyFeatureIndex = props.field.slice(-1); //TODO: This is a horrible hack
    const dispatch = useDispatch();

    const state: FeatureSearchBoxState = useSelector<
        RootState,
        FeatureSearchBoxState
    >((root: RootState) => {
        return {
            selected: Selector.selected(props.field, root),
            loading: Selector.isLoading(props.field, root),
            value: Selector.value(props.field, root),
            results: Selector.searchResults(props.field, root),
        };
    });

    const onSearchChange = (query: string | undefined) => {
        if (query === undefined || query === '') {
            LegacyAPI.setActiveFeature(
                legacyFeatureIndex,
                props.filter,
                '',
                '',
                0,
                null
            );

            dispatch(Action.clear(props.field));
        } else {
            dispatch(
                Action.search(
                    props.field,
                    LegacyAPI.getActiveLoom(),
                    props.filter,
                    query
                )
            );
        }
    };

    const onResultSelect = (_, { result }) => {
        const selection = findResult(result, props.colour, state.results);

        if (selection) {
            if (!__TEST_ONLY__) {
                LegacyAPI.updateFeature(
                    legacyFeatureIndex,
                    props.filter,
                    selection.title,
                    selection.category,
                    selection.description
                );
            }

            dispatch(Action.select(props.field, selection));
        }
    };

    /**
     * Input element for the Search box has an "action" button
     * which either has a 'search' icon, or,
     * when a search result is selected, a clickable cross icon.
     * Clicking the cross should clear the search field.
     */
    const input = () => {
        return {
            action: {
                ...(state.selected && {
                    onClick: () => onSearchChange(''),
                }),
                icon: state.selected ? 'cancel' : 'search',
            },
            actionPosition: 'left',
            icon: false,
        };
    };

    //TODO: A hack to ensure the old state managment knows something is selected
    if (state.selected && !__TEST_ONLY__) {
        const legacyFeature = LegacyAPI.getActiveFeatures()[legacyFeatureIndex];
        const currentFeature = {
            type: props.filter,
            featureType: state.selected.category,
            feature: state.selected.title,
            threshold: 0,
            metadata: { description: state.selected.description },
        };
        if (!R.equals(currentFeature, legacyFeature)) {
            LegacyAPI.updateFeature(
                legacyFeatureIndex,
                props.filter,
                state.selected.title,
                state.selected.category,
                state.selected.description
            );
        }
    }

    const displayResults = R.fromPairs(
        R.sortWith([R.comparator(orderCategories)], state.results).map(
            featuresToResults
        )
    );

    return (
        <Segment
            color={props.colour as SemanticCOLORS}
            inverted
            className='noPadding'>
            <Search
                category
                className='feature-search-input'
                input={input()}
                loading={state.loading}
                placeholder='Search...'
                onSearchChange={(_, data) => onSearchChange(data.value)}
                onResultSelect={onResultSelect}
                results={displayResults}
                value={state.value}
            />
        </Segment>
    );
};
