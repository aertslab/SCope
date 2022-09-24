import React, { useState } from 'react';
import { Button, Form } from 'semantic-ui-react';

type NewProjectFormProps = {
    createAction: (_name: string) => void;
    cancelAction: () => void;
};

export const NewProjectForm: React.FC<NewProjectFormProps> = (props) => {
    const [name, setName] = useState('');
    return (
        <Form>
            <Form.Field>
                <label>Project Name</label>
                <input
                    placeholder='name'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </Form.Field>
            <Button
                onClick={() => props.createAction(name)}
                disabled={name === ''}
                content='Create'
            />
            <Button onClick={props.cancelAction}>Cancel</Button>
        </Form>
    );
};
