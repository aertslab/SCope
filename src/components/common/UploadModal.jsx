import React, { Component } from 'react';
import { Button, Modal, Grid, Input, Progress } from 'semantic-ui-react';
import FileReaderInput from 'react-file-reader-input';
import Uploader from '../common/Uploader';

export default class UploadModal extends Component {
    constructor() {
        super();
        this.state = {
            uploadLoomFile: null,
            uploadLoomProgress: 0,
        }
    }
    
    render() {
        return (
            <Modal open={this.props.opened} onClose={this.props.onClose} closeIcon>
                <Modal.Header>{this.props.title}</Modal.Header>
                <Modal.Content image>
                    <Modal.Description>
                        <Grid>
                            <Grid.Row>
                                <Grid.Column width={13}>
                                    <FileReaderInput as="binary" id="my-file-input" onChange={this.selectLoomFile.bind(this)}>
                                        <Input
                                            label="File to be uploaded:" labelPosition='left' action={{ color: this.state.uploadLoomFile ? 'grey' : 'orange', content:"Select a file..."}} fluid 
                                            placeholder={ this.state.uploadLoomFile ? this.state.uploadLoomFile.name : ""}
                                        />
                                    </FileReaderInput>
                                </Grid.Column>
                                <Grid.Column width={3}>
                                    <Button color={this.state.uploadLoomFile ? 'orange' : 'grey'} onClick={this.uploadLoomFile.bind(this)} disabled={!this.state.uploadLoomFile || (this.state.uploadLoomProgress > 0)}> Upload!</Button>
                                </Grid.Column>
                            </Grid.Row>
                            <Grid.Row>
                                <Grid.Column width={3}>
                                    Upload progress:
                                </Grid.Column>
                                <Grid.Column width={13}>
                                    <Progress percent={this.state.uploadLoomProgress} indicating progress disabled></Progress>
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                    </Modal.Description>
                </Modal.Content>
            </Modal>
        );
    }

    selectLoomFile(event, selection) {
        selection.forEach((selected) => {
            const [event, file] = selected;
            this.setState({ uploadLoomFile: file })
        })
    }

    uploadLoomFile() {
        let file = this.state.uploadLoomFile;
        let uploader = new Uploader();
        uploader.upload(this.props.uuid, this.props.type, file, (progress) =>{
            this.setState({ uploadLoomProgress: progress });
        }, (filename) => {
            this.setState({ uploadLoomFile: null, uploadLoomProgress: 0 })
            this.props.onUploaded(filename);
        });
    }
}