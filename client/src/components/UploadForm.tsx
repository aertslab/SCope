import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Modal, Input, Progress } from 'semantic-ui-react';
import FileReaderInput from 'react-file-reader-input';

import { RootState } from '../redux/reducers';
import { UploadState } from '../redux/types';
import { uploadRequest } from '../redux/actions';

// import { upload } from '../api/upload';

type UploadFormProps = {
    onCancel: () => void;
    onUploaded: (__filename: string) => void;
    project: string;
};

type UploadFormState = {
    state: UploadState;
    progress: number;
    file?: File;
    error: string;
};

type UploadFormTransitive = {
    file?: File;
    name: string;
};

export const UploadForm: React.FC<UploadFormProps> = (props) => {
    const dispatch = useDispatch();

    const state: UploadFormState = useSelector<RootState, UploadFormState>(
        (root: RootState) => ({
            state: root.main.upload.state,
            progress: root.main.upload.progress,
            file: root.main.upload.file,
            error: root.main.error,
        })
    );

    useEffect(() => {
        if (state.state === 'finished') {
            props.onUploaded(state.file?.name || '');
        }
    });

    const [transitive, setTransitive] = useState<UploadFormTransitive>({
        file: undefined,
        name: '',
    });

    const selectFiles = (event, selection: Array<[ProgressEvent, File]>) => {
        if (selection.length > 0) {
            setTransitive({ ...transitive, file: selection[0][1] });
        }
    };

    const uploadFile = () => {
        if (transitive.file !== undefined && transitive.name !== '') {
            dispatch(
                uploadRequest(transitive.file, transitive.name, props.project)
            );
        }
    };

    return (
        <Modal open onClose={props.onCancel} closeIcon className='upload'>
            <Modal.Header>Add a dataset to your project</Modal.Header>
            <Modal.Content>
                <Modal.Description>
                    <div className='scope-row'>
                        <input
                            type='text'
                            minLength={1}
                            placeholder='Dataset name'
                            onChange={(e) =>
                                setTransitive({
                                    ...transitive,
                                    name: e.target.value,
                                })
                            }
                        />
                        <FileReaderInput
                            as='binary'
                            id='my-file-input'
                            onChange={selectFiles}>
                            <Input
                                label='File to be uploaded:'
                                labelPosition='left'
                                action={{
                                    color:
                                        transitive.file !== undefined
                                            ? 'grey'
                                            : 'orange',
                                    content: 'Select a file...',
                                }}
                                fluid
                                placeholder={'Upload data file...'}
                                error={state.error !== ''}
                            />
                        </FileReaderInput>
                        <Button
                            className='scope-row-element'
                            color={
                                transitive.file !== undefined
                                    ? 'orange'
                                    : 'grey'
                            }
                            onClick={uploadFile}
                            disabled={transitive.file === undefined}>
                            {' '}
                            Upload!
                        </Button>
                    </div>
                    <div>
                        <span>Upload progress:</span>
                        <span>
                            <Progress
                                percent={
                                    state.file !== undefined
                                        ? Math.ceil(state.progress * 100)
                                        : 0
                                }
                                error={state.error !== ''}
                                indicating
                                progress
                                disabled></Progress>
                        </span>
                    </div>
                </Modal.Description>
            </Modal.Content>
        </Modal>
    );
};
