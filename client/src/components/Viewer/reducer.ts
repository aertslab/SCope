import produce from 'immer';
import { Reducer } from 'redux';

import { Layout } from './model';
import * as Model from './model';
import {
    ViewerAction,
    ChangeLayout,
    DeleteViewer,
    SplitViewer,
} from './actions';
import * as AT from './actionTypes';

const initialState: Layout = Model.newLayout();

export const reducer: Reducer<Layout, ViewerAction> = produce(
    (draft: Layout, action: ViewerAction) => {
        switch (action.type) {
            case AT.SPLIT_HORIZONTAL:
                draft = Model.verticalSplit(
                    draft,
                    (action as SplitViewer).payload
                );
                break;

            case AT.SPLIT_VERTICAL:
                draft = Model.horizontalSplit(
                    draft,
                    (action as SplitViewer).payload
                );
                break;

            case AT.DELETE:
                draft = Model.deleteView(
                    draft,
                    (action as DeleteViewer).payload
                );
                break;

            case AT.LAYOUT:
                draft.width = (action as ChangeLayout).payload.width;
                draft.height = (action as ChangeLayout).payload.height;
                break;
        }
    },
    initialState
);
