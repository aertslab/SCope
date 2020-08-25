import produce from 'immer';
import { has } from 'ramda';

import * as t from './actionTypes';
import { State, init } from './model';
import { SearchAction } from './actions';

const initialState: State = {};

const reducer = produce((draft: State, action: SearchAction) => {
    switch (action.type) {
        case t.QUERY:
            if (!has(action.payload.field, draft)) {
                draft[action.payload.field] = init(action.payload.field);
            }

            draft[action.payload.field].loading = true;
            draft[action.payload.field].value = action.payload.query.query;
            draft[action.payload.field].selected = undefined;
            break;

        case t.FILTER:
            if (!has(action.payload.field, draft)) {
                draft[action.payload.field] = init(action.payload.field);
            }

            draft[action.payload.field].filter = action.payload.filter;
            break;

        case t.RESULTS:
            if (!has(action.payload.field, draft)) {
                draft[action.payload.field] = init(action.payload.field);
            }

            draft[action.payload.field].loading = false;
            draft[action.payload.field].results = action.payload.results;
            break;

        case t.SELECT:
            if (!has(action.payload.field, draft)) {
                draft[action.payload.field] = init(action.payload.field);
            }

            draft[action.payload.field].loading = false;
            if (action.payload.selection !== undefined) {
                draft[action.payload.field].value =
                    action.payload.selection.title;
            } else {
                draft[action.payload.field].value = '';
                draft[action.payload.field].results = [];
            }
            draft[action.payload.field].selected = action.payload.selection;
            break;

        case t.ERROR:
            if (!has(action.payload.field, draft)) {
                draft[action.payload.field] = init(action.payload.field);
            }

            draft[action.payload.field].error = action.payload.message;
            break;
    }
}, initialState);

export { reducer };
