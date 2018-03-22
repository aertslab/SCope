import React, { Component } from 'react';
import { Button, Modal, Grid, Input, Progress } from 'semantic-ui-react';
import FileReaderInput from 'react-file-reader-input';

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

		if (file == null) {
			alert("Please select a .loom file first")
			return
		}

		let form = new FormData();
		form.append('UUID', this.props.uuid);
		form.append('file-type', this.props.type);
		form.append('file', file);

		let xhr = new XMLHttpRequest();
		xhr.open("POST", BACKEND.proto + "://" + BACKEND.host + ":" + BACKEND.XHRport + "/");
		xhr.upload.addEventListener('progress', (event) => {
			if (DEBUG) console.log("Data uploaded: " + event.loaded + "/" + event.total);
			let progress = (event.loaded / event.total * 100).toPrecision(1);
			this.setState({ uploadLoomProgress: progress });
		});
		xhr.upload.addEventListener('load', (event) => {
			if (DEBUG) console.log("file uploaded: " + file.name);
            this.setState({ uploadLoomFile: null, uploadLoomProgress: 0 })
            setTimeout(this.props.onUploaded, 1000);
		})
		xhr.setRequestHeader("Content-Disposition", "attachment;filename=" + file.name)
		xhr.send(form);
	}
}