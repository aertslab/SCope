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
import { searchResults, isLoading, isSelected } from './selectors';

import './FeatureSearchBox.css';

type FeatureSearchBoxProps = {
    /** A unique identifier */
    field: string;

    /** The feature type to search for */
    filter: FeatureFilter;

    /** Restrict the dropdown to _only_ this initialised feature type */
    singleFeature: boolean;

    /** Used to en/dis-able the entire search box */
    enabled: boolean;

    /** True when a search result is selcted */
    selected: boolean;

    /** Background colour */
    colour: string;

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

    /** Filter search results given a filter */
    filterResults?: (
        field: string,
        filter: FeatureFilter
    ) => Action.SearchFilter;
};

/**
 * A text search input for (selectable categories) properties on the dataset.
 */
const FeatureSearchBox = (props: FeatureSearchBoxProps) => {
    const { enabled, singleFeature, loading } = props;
    const options = [
        { key: 'all', text: 'all features', value: 'all' },
        { key: 'gene', text: 'gene', value: 'gene' },
        { key: 'regulon', text: 'regulon', value: 'regulon' },
        { key: 'cluster', text: 'cluster', value: 'cluster' },
    ];

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
                R.propEq('title', result.title),
                searchSpace
            ) as FeatureSearchSelection[];

            if (selected.length === 1) {
                BackendAPI.updateFeature(
                    props.field.slice(-1), //TODO: This is a horrible hack
                    props.filter,
                    selected[0]?.title,
                    selected[0]?.category,
                    selected[0]?.description
                );

                props.selectResult(props.field, selected[0]);
            }
        }
    };

    const onFilterChange = (_, { value }) => {
        props.filterResults(props.field, value);
    };

    return (
        <Segment
            color={props.colour as SemanticCOLORS}
            inverted
            className='noPadding'>
            <Search
                category
                className='feature-search-input'
                input={{
                    icon: props.selected ? '' : 'search',
                    iconPosition: 'left',
                }}
                loading={loading}
                placeholder='Search...'
                onSearchChange={onSearchChange}
                onResultSelect={onResultSelect}
                results={props.results.map(featuresToResults)}
                value={props.value}
                disabled={!enabled}
            />
            <Select
                className={'icon typeSelect'}
                options={options}
                defaultValue={props.filter}
                disabled={!enabled || singleFeature}
                onChange={onFilterChange}
            />
        </Segment>
    );
};

const mapStateToProps = (state: RootState, ownProps: FeatureSearchBoxProps) => {
    return {
        results: searchResults(ownProps.field, state),
        loading: isLoading(ownProps.field, state),
        selected: isSelected(ownProps.field, state),
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        search: (field: string, filter: FeatureFilter, query: string) =>
            dispatch(
                Action.search(field, BackendAPI.getActiveLoom(), filter, query)
            ),

        filterResults: (field: string, filter: FeatureFilter) =>
            dispatch(Action.filter(field, filter)),

        selectResult: (field: string, selection: FeatureSearchSelection) =>
            dispatch(Action.select(field, selection)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(FeatureSearchBox);
