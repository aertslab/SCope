import produce from 'immer';

import * as Action from '../actionTypes';
import { MainState, MainAction, SESSION_READ } from '../types';

const initialState: MainState = {
    isAppLoading: true,
    uuid: '',
    sessionMode: SESSION_READ,
    cookieConsent: false,
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
        case Action.CONSENT_TO_COOKIES:
            draft.cookieConsent = true;
            break;
    }
}, initialState);

export default main;
