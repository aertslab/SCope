import produce, { Draft } from 'immer';

import * as t from './actionTypes';
import { State } from './model';
import { GProfilerAction } from './actions';
import { Reducer } from 'redux';

const initialState: State = {
    error: '',
    display: false,
    selectedTopGeneListsSizes: [],
    isFetchingAvailableOrganisms: false,
    availableOrganisms: [],
    selectedOrganism: '',
    selectedSortBy: '',
    gProfilerToken: '',
};

const reducer: Reducer<State, GProfilerAction> = produce(
    (draft: Draft<State>, action: GProfilerAction) => {
        switch (action.type) {
            case t.TOGGLE_MODAL:
                draft.display = !draft.display;
                if (draft.display) {
                    draft.selectedTopGeneListsSizes = [];
                    draft.selectedOrganism = '';
                    draft.selectedSortBy = '';
                    draft.gProfilerToken = '';
                    if (draft.availableOrganisms.length > 0) {
                        draft.error = '';
                    }
                }
                break;
            case t.SET_TOP_GENE_LIST_SIZES:
                draft.selectedTopGeneListsSizes =
                    action.payload.topGeneListSizes;
                break;
            case t.SELECT_ORGANISM:
                draft.selectedOrganism = action.payload.organism;
                break;
            case t.SELECT_SORT_BY:
                draft.selectedSortBy = action.payload.sortBy;
                break;
            case t.SET_GPROFILER_TOKEN:
                draft.selectedOrganism = '';
                draft.gProfilerToken = action.payload.gProfilerToken;
                break;
            case t.FETCH_AVAILABLE_ORGANISMS:
                draft.isFetchingAvailableOrganisms = true;
                break;
            case t.SET_AVAILABLE_ORGANISMS:
                draft.availableOrganisms = action.payload.availableOrganisms;
                draft.isFetchingAvailableOrganisms = false;
                if (draft.availableOrganisms.length > 0) draft.error = '';
                break;
            case t.SET_ERROR:
                draft.error = action.payload.error;
                draft.isFetchingAvailableOrganisms = false;
                break;
        }
    },
    initialState
);

export { reducer };
