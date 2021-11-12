import { call, put, select, takeEvery } from 'redux-saga/effects';

import { Result, match } from '../../../result';
import * as API from '../../../api';

import * as T from '../../types';
import * as AT from '../../actionTypes';
import * as A from '../../actions';

import * as AuthSelectors from '../../../components/Auth/selectors';

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

export * from '../../../components/Search/effects';
export {
    watchGuestLogin,
    watchRequestToken,
    watchRequestProviders,
} from '../../../components/Auth';
export * from '../../../components/Legacy';
