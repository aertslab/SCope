import { RootState } from './reducers';
import { Project, DataSet } from '../api';

export const projects = (state: RootState): Array<Project> => {
    return state.main.projects;
};

export const datasets = (state: RootState, proj: string): Array<DataSet> => {
    return state.main.datasets.filter((d: DataSet) => d.project === proj);
};
