import produce from 'immer';

import * as Action from '../actionTypes';
import { MainState, MainAction, SESSION_READ } from '../types';

const initialState: MainState = {
    isAppLoading: false,
    uuid: '',
    sessionMode: SESSION_READ,
    projects: [],
    datasets: [],
    upload: {
        state: 'none',
        progress: 0,
        file: undefined,
    },
    error: '',
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
        case Action.MY_PROJECTS:
            draft.projects = action.payload.projects;
            draft.datasets = action.payload.datasets;
            break;
        case Action.ADD_PROJECT:
            draft.projects = [...draft.projects, action.payload.project];
            break;
        case Action.ADD_DATASET:
            draft.datasets = [...draft.datasets, action.payload.dataset];
            break;
        case Action.ERROR:
            console.error(action.payload);
            draft.error = action.payload;
            break;
        case Action.UPLOAD_PROGRESS:
            draft.upload.state = 'in progress';
            draft.upload.progress = action.payload.progress;
            draft.upload.file = action.payload.file;
            break;
        case Action.UPLOAD_SUCCESS:
            draft.upload.state = 'finished';
            draft.upload.progress = 0;
            draft.upload.file = undefined;
            break;
    }
}, initialState);

export default main;
