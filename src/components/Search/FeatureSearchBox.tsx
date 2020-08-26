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
import { Features } from '../../api';

import { BackendAPI } from '../common/API';

import {
    FeatureFilter,
    FeatureSearchSelection,
    toFeatureFilter,
    featuresToResults,
    makeSelection,
} from './model';
import * as Action from './actions';
import * as Selector from './selectors';

import './FeatureSearchBox.css';

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
const FeatureSearchBox = (props: FeatureSearchBoxProps) => {
    const onSearchChange = (_, { value }) => {
        if (value === '') {
            BackendAPI.setActiveFeature(
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
            const searchSpace: FeatureSearchSelection[] = R.chain(
                (r) =>
                    R.map(makeSelection(props.colour, r.category), r.results),
                props.results
            );

            const selected = R.filter(
                R.propEq<keyof FeatureSearchSelection, any>(
                    'title',
                    result.title
                ),
                searchSpace
            );

            if (selected.length === 1) {
                BackendAPI.updateFeature(
                    props.field.slice(-1), //TODO: This is a horrible hack
                    props.filter,
                    selected[0].title,
                    selected[0].category,
                    selected[0].description
                );

                props.selectResult(props.field, selected[0]);
            }
        }
    };

    if (props?.value && props?.selected) {
        // A hack to ensure the old state managment knows something is selected
        onResultSelect(undefined, { result: { title: props?.value } });
    }

    return (
        <Segment
            color={props.colour as SemanticCOLORS}
            inverted
            className='noPadding'>
            <Search
                category
                className='feature-search-input'
                input={{
                    icon: 'search',
                    iconPosition: 'left',
                }}
                loading={props.loading}
                placeholder='Search...'
                onSearchChange={onSearchChange}
                onResultSelect={onResultSelect}
                results={props.results?.map(featuresToResults)}
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
                Action.search(field, BackendAPI.getActiveLoom(), filter, query)
            ),

        selectResult: (field: string, selection: FeatureSearchSelection) =>
            dispatch(Action.select(field, selection)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(FeatureSearchBox);
