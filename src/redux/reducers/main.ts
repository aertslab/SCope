import produce from 'immer';

import * as Action from '../actionTypes';
import { MainState, MainAction } from '../types';

const initialState: MainState = {
    isAppLoading: true,
    uuid: '',
    sessionMode: 'r',
    sidebarIsVisible: true,
};

const main = produce((draft: MainState, action: MainAction) => {
    switch (action.type) {
        case Action.SET_APP_LOADING:
            draft.isAppLoading = action.payload;
            break;
        case Action.SET_UUID:
            draft.uuid = action.payload;
            break;
        case Action.SET_SESSION_MODE:
            draft.sessionMode = action.payload;
            break;
        case Action.TOGGLE_SIDEBAR_VISIBLE:
            draft.sidebarIsVisible = !draft.sidebarIsVisible;
            break;
    }
}, initialState);

export default main;
