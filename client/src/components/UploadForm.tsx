import React, { SyntheticEvent } from 'react';
import { Button, Modal, Input, Progress } from 'semantic-ui-react';
import FileReaderInput from 'react-file-reader-input';
import * as R from 'ramda';
import { getReasonPhrase } from 'http-status-codes';

import { upload } from '../api/upload';
import { Result, success } from '../result';

type UploadFormProps = {
    title: string;
    type: string;
    uuid: string;
    open: boolean;
    onClose: (event: SyntheticEvent, data: object) => void;
    onUploaded: (filename: string) => void;
};

type UploadState = {
    files: File[];
    progress: number;
};

type UploadFormState =
    | { tag: 'initialised' }
    | { tag: 'selected'; files: File[]; progress: number }
    | { tag: 'completed' }
    | { tag: 'error'; msg: string };

export class UploadForm extends React.Component<
    UploadFormProps,
    UploadFormState
> {
    constructor(props: UploadFormProps) {
        super(props);
        this.state = { tag: 'initialised' };
    }

    showPlaceholder(): string {
        switch (this.state.tag) {
            case 'selected':
                return R.join(
                    ', ',
                    R.map((f) => f.name, this.state.files)
                );
            case 'error':
                return this.state.msg;

            default:
                return '';
        }
    }

    render() {
        return (
            <Modal
                open={this.props.open}
                onClose={this.props.onClose}
                className='upload'
                closeIcon>
                <Modal.Header>{this.props.title}</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <div className='scope-row'>
                            <FileReaderInput
                                as='binary'
                                id='my-file-input'
                                onChange={this.selectFiles.bind(this)}>
                                <Input
                                    label='File to be uploaded:'
                                    labelPosition='left'
                                    action={{
                                        color:
                                            this.state.tag === 'selected'
                                                ? 'grey'
                                                : 'orange',
                                        content: 'Select a file...',
                                    }}
                                    fluid
                                    placeholder={this.showPlaceholder()}
                                    error={this.state.tag === 'error'}
                                />
                            </FileReaderInput>
                            <Button
                                className='scope-row-element'
                                color={
                                    this.state.tag === 'selected'
                                        ? 'orange'
                                        : 'grey'
                                }
                                onClick={this.uploadFiles.bind(this)}
                                disabled={this.state.tag !== 'selected'}>
                                {' '}
                                Upload!
                            </Button>
                        </div>
                        <div>
                            <span>Upload progress:</span>
                            <span>
                                <Progress
                                    percent={
                                        this.state.tag === 'selected'
                                            ? this.state.progress
                                            : 0
                                    }
                                    error={this.state.tag === 'error'}
                                    indicating
                                    progress
                                    disabled></Progress>
                            </span>
                        </div>
                    </Modal.Description>
                </Modal.Content>
            </Modal>
        );
    }

    selectFiles(event, selection: Array<[ProgressEvent, File]>) {
        this.setState({
            tag: 'selected',
            files: selection.map(
                (selected: [ProgressEvent, File]) => selected[1]
            ),
            progress: 0,
        });
    }

    updateProgress(progress: number) {
        if (this.state.tag === 'selected') {
            this.setState({
                tag: 'selected',
                progress: progress / this.state.files.length,
            });
        }
    }

    completed(filename, status) {
        if (status === 200) {
            this.setState({ tag: 'completed' });
            this.props.onUploaded(filename);
        } else {
            const reason = getReasonPhrase(status);
            this.setState({
                tag: 'error',
                msg: `Error uploading ${filename}: ${reason}. Please try again later`,
            });
        }
    }

    uploadFiles() {
        if (this.state.tag === 'selected') {
            this.state.files.forEach((file) => {
                upload(
                    this.props.uuid,
                    this.props.type,
                    file,
                    this.updateProgress.bind(this),
                    this.completed.bind(this)
                );
            });
        }
    }
}
