import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Accordion, Button, Icon, List } from 'semantic-ui-react';
import * as R from 'ramda';

import { RootState } from '../redux/reducers';
import * as Select from '../redux/selectors';
import { DataSet, Project } from '../api';

import { UploadForm } from './UploadForm';

type ProjectViewProps = {
    name: string;
    project: string;
};

type ProjectsOverviewState = Array<Project>;
type ProjectViewState = Array<DataSet>;

const ProjectView: React.FC<ProjectViewProps> = (props) => {
    const dispatch = useDispatch();
    const datasets = useSelector<RootState, ProjectViewState>(
        (state: RootState) => Select.datasets(state, props.project)
    );

    const [displayUpload, setDisplayUpload] = useState(false);

    /* const selectDataset = (project: string, dataset: number) => {
     *     dispatch( */

    return (
        <div>
            <Button
                content='Add dataset'
                onClick={() => setDisplayUpload(true)}
            />
            {displayUpload ? (
                <UploadForm
                    onCancel={() => setDisplayUpload(false)}
                    onUploaded={() => setDisplayUpload(false)}
                    project={props.project}
                />
            ) : (
                <List>
                    {datasets.map((d) => (
                        <List.Item
                            key={d.id}
                            as={'a'}
                            onClick={selectDataset(props.project, d.id)}>
                            {d.name}
                        </List.Item>
                    ))}
                </List>
            )}
        </div>
    );
};

export const ProjectsOverview: React.FC<{}> = () => {
    const projects = useSelector<RootState, ProjectsOverviewState>(
        Select.projects
    );

    const [activeProjects, setActiveProjects] = useState<number[]>([]);

    const toggleActiveProject = (_e, titleProps) => {
        const { index } = titleProps;
        if (typeof index === 'number') {
            activeProjects.includes(index)
                ? setActiveProjects(
                      activeProjects.filter((pid) => pid !== index)
                  )
                : setActiveProjects(R.append(index, activeProjects));
        }
    };

    return projects.length === 0 ? (
        <p>No projects</p>
    ) : (
        <Accordion fluid styled exclusive={false}>
            {projects.map((project, idx) => {
                const active = activeProjects.includes(idx);
                return (
                    <React.Fragment key={idx}>
                        <Accordion.Title
                            active={active}
                            index={idx}
                            onClick={toggleActiveProject}>
                            <Icon name={active ? 'folder open' : 'folder'} />
                            {project.name}
                        </Accordion.Title>
                        <Accordion.Content
                            active={activeProjects.includes(idx)}>
                            <ProjectView
                                key={project.id}
                                name={project.name}
                                project={project.id}
                            />
                        </Accordion.Content>
                    </React.Fragment>
                );
            })}
        </Accordion>
    );
};
