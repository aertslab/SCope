/**
 * Sidebar for the SCope application: quick reference for projects and datasets.
 */

import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button } from 'semantic-ui-react';

import * as A from '../redux/actions';

import { NewProjectForm } from './NewProjectForm';
import { ProjectsOverview } from './ProjectsOverview';

const Sidebar: React.FC<{}> = () => {
    const dispatch = useDispatch();

    const [showNewProjectForm, setShowNewProjectForm] = useState(false);

    const closeForm = () => setShowNewProjectForm(false);

    const create = (name: string) => {
        dispatch(A.newProject(name));
        setShowNewProjectForm(false);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                maxWidth: '200px',
                height: '100%',
                padding: '10px',
                borderRight: '1px solid #ccc',
            }}>
            {showNewProjectForm ? (
                <NewProjectForm
                    createAction={create}
                    cancelAction={closeForm}
                />
            ) : (
                <Button onClick={() => setShowNewProjectForm(true)}>
                    New Project
                </Button>
            )}

            <h4>Projects</h4>
            <ProjectsOverview />

            <h4>Public datasets</h4>
        </div>
    );
};

export { Sidebar };
