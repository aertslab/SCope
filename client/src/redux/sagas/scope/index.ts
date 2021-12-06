import { buffers, eventChannel } from 'redux-saga';
import { call, put, select, take, takeEvery } from 'redux-saga/effects';

import { Result, match } from '../../../result';
import * as API from '../../../api';

import * as T from '../../types';
import * as AT from '../../actionTypes';
import * as A from '../../actions';

import * as AuthSelectors from '../../../components/Auth/selectors';

declare const API_PREFIX: string;

export function* createNewProject(action: T.NewProjectAction) {
    const token = yield select(AuthSelectors.token);
    if (token === null) {
        put(A.error('No API token'));
    } else {
        const response: Result<API.Project, string> = yield call(
            API.makeProject,
            token,
            action.payload.name
        );

        yield put(
            match<API.Project, string, T.MainAction>(
                (project: API.Project) => A.addProject(project),
                (err: string) => A.error(err),
                response
            )
        );
    }
}

export function* watchCreateNewProject() {
    yield takeEvery(AT.NEW_PROJECT, createNewProject);
}

const createUploadFileChannel = (
    endpoint: string,
    token: string,
    file: File
) => {
    return eventChannel(
        (emitter) => API.upload(emitter, endpoint, token, file),
        buffers.sliding(2)
    );
};

const decodeDataset = (data: unknown, project: string): API.DataSet => {
    return {
        id: (data as { id: number }).id,
        name: (data as { name: string }).name,
        project,
    };
};

export function* uploadFile(endpoint: string, project: string, file: File) {
    const token = yield select(AuthSelectors.token);
    const channel = yield call(createUploadFileChannel, endpoint, token, file);
    while (true) {
        const { progress = 0, err, success, response } = yield take(channel);
        if (err) {
            yield put(A.error(err));
            return;
        }
        if (success) {
            yield put(A.uploadSuccess(file));
            yield put(A.addDataset(decodeDataset(response, project)));
            return;
        }
        yield put(A.uploadProgress(file, progress));
    }
}

export function* uploadRequest(action: T.UploadRequest) {
    const url = new URL(API_PREFIX + 'project/dataset');
    url.search = new URLSearchParams({
        name: action.payload.name,
        project: action.payload.project,
    }).toString();
    yield call(
        uploadFile,
        url.toString(),
        action.payload.project,
        action.payload.file
    );
}

export function* watchUploadRequest() {
    yield takeEvery(AT.UPLOAD_REQUEST, uploadRequest);
}

export * from '../../../components/Search/effects';
export {
    watchGuestLogin,
    watchRequestToken,
    watchRequestProviders,
} from '../../../components/Auth';
export * from '../../../components/Legacy';
