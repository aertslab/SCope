import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import {
    Segment,
    Search,
    SearchResultsProps,
    StrictSearchCategoryProps,
    Select,
    SemanticCOLORS,
} from 'semantic-ui-react';
import { debounce } from 'lodash';
import * as R from 'ramda';

import { RootState } from '../../redux/reducers';
import { Features, LegacyAPI } from '../../api';

import {
    FeatureFilter,
    FeatureSearchSelection,
    toFeatureFilter,
    featuresToResults,
    findResult,
} from './model';
import * as Action from './actions';
import * as Selector from './selectors';

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

    /** A search result has been selected */
    selected?: boolean;

    /** Show a loading indication */
    loading?: boolean;

    /** Text to display in the input */
    value?: string;

    /** Search results */
    results?: Features[];

    /** Search for a given query */
    search?: (
        field: string,
        filter: FeatureFilter,
        query: string
    ) => Action.SearchQuery;

    /** "Select" a result from the search results */
    selectResult?: (
        field: string,
        selection: FeatureSearchSelection
    ) => Action.SearchResultSelect;
};

/**
 * A text search input for items in a dataset.
 */
export const FeatureSearchBox = (props: FeatureSearchBoxProps) => {
    const onSearchChange = (_, { value }) => {
        if (value === '') {
            LegacyAPI.setActiveFeature(
                props.field.slice(-1), //TODO: This is a horrible hack
                props.filter,
                '',
                '',
                0,
                null
            );
            props.selectResult(props.field, undefined);
        } else {
            props.search(props.field, props.filter, value);
        }
    };

    const onResultSelect = (_, { result }) => {
        if (props.results) {
            const selected = findResult(result, props.colour, props.results);

            if (selected) {
                if (!__TEST_ONLY__) {
                    LegacyAPI.updateFeature(
                        props.field.slice(-1), //TODO: This is a horrible hack
                        props.filter,
                        selected.title,
                        selected.category,
                        selected.description
                    );
                }

                props.selectResult(props.field, selected);
            }
        }
    };

    /**
     * Icon in the Search box is either a 'search' icon, or,
     * when a search result is selected, a clickable cross icon.
     * Clicking the cross should clear the search field.
     */
    const icon = () => {
        return {
            ...(props.selected && {
                onClick: () => onSearchChange(undefined, { value: '' }),
            }),
            icon: props.selected ? 'cancel' : 'search',
            iconPosition: 'left',
        };
    };

    //TODO: A hack to ensure the old state managment knows something is selected
    if (props.value && props.selected) {
        const selected = findResult(
            { title: props.value },
            props.colour,
            props.results
        );

        LegacyAPI.updateFeature(
            props.field.slice(-1), //TODO: This is a horrible hack
            props.filter,
            selected.title,
            selected.category,
            selected.description
        );
    }

    const displayResults = R.fromPairs(
        props.results ? props.results.map(featuresToResults) : []
    );

    return (
        <Segment
            color={props.colour as SemanticCOLORS}
            inverted
            className='noPadding'>
            <Search
                category
                className='feature-search-input'
                input={icon()}
                loading={props.loading}
                placeholder='Search...'
                onSearchChange={onSearchChange}
                onResultSelect={onResultSelect}
                results={displayResults}
                value={props.value}
            />
        </Segment>
    );
};

const mapStateToProps = (state: RootState, ownProps: FeatureSearchBoxProps) => {
    return {
        results: Selector.searchResults(ownProps.field, state),
        loading: Selector.isLoading(ownProps.field, state),
        value: Selector.value(ownProps.field, state),
        selected: Selector.isSelected(ownProps.field, state),
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        search: (field: string, filter: FeatureFilter, query: string) =>
            dispatch(
                Action.search(field, LegacyAPI.getActiveLoom(), filter, query)
            ),

        selectResult: (field: string, selection: FeatureSearchSelection) =>
            dispatch(Action.select(field, selection)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(FeatureSearchBox);
