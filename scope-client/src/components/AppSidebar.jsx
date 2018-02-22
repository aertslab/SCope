import React, { Component } from 'react';
import { Sidebar, Menu, Icon, Button, Divider, Modal, Checkbox, Grid, Input, Label, Progress } from 'semantic-ui-react';
import FileReaderInput from 'react-file-reader-input';
import { BackendAPI } from './common/API';

export default class AppSidebar extends Component {
	constructor() {
		super();
		this.state = {
			activeLoom: null,
			uploadLoomFile: null,
			uploadLoomModalOpened: false,
			uploadLoomProgress: 0,
			myLooms: [],
			settings: BackendAPI.getSettings()
		}
		this.updateMyLooms();
	}

	render () {
		return (
			<Sidebar as={Menu} animation="push" visible={this.props.visible} vertical>
				<Menu.Item>
					<Menu.Header>DATASETS</Menu.Header>
						<Menu.Menu>
							<Menu.Item key="new" onClick={this.toggleUploadLoomModal.bind(this)}>
								<Icon name="add" />
								<em>Upload new dataset</em>
							</Menu.Item>
							{this.myLooms()}
						</Menu.Menu>
					<Divider />
					<Menu.Header>SETTINGS</Menu.Header>
					<Menu.Menu>
						<Menu.Item>
							<Checkbox toggle label="Log transform" checked={this.state.settings.hasLogTransform} onChange={this.toggleLogTransform.bind(this)} />
						</Menu.Item>
						<Menu.Item>
							<Checkbox toggle label="CPM normalize" checked={this.state.settings.hasCpmNormalization} onChange={this.toggleCpmNormization.bind(this)} />
						</Menu.Item>
					</Menu.Menu>
				</Menu.Item>
				<Modal open={this.state.uploadLoomModalOpened} onClose={this.toggleUploadLoomModal.bind(this)} closeIcon>
					<Modal.Header>Import a .loom file</Modal.Header>
					<Modal.Content image>
						<Modal.Description>
							<Grid>
								<Grid.Row>
									<Grid.Column width={13}>
										<FileReaderInput as="binary" id="my-file-input" onChange={this.selectLoomFile.bind(this)}>
											<Input
												label="File to be uploaded:" labelPosition='left' action="Select a file..." fluid
												placeholder={ this.state.uploadLoomFile ? this.state.uploadLoomFile.name : ""}
											/>
										</FileReaderInput>
									</Grid.Column>
									<Grid.Column width={3}>
										<Button onClick={this.uploadLoomFile.bind(this)} disabled={this.state.uploadLoomProgress > 0}> Upload!</Button>
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
			</Sidebar>
		);
	}

	updateMyLooms() {
		let query = {};
		BackendAPI.getConnection().then((gbc) => {
			gbc.services.scope.Main.getMyLooms(query, (error, response) => {
				if (response !== null) {					
					console.log("Loaded .loom files: ", response.myLooms);
					this.setState({ myLooms: response.myLooms });
				} else {
					console.log("No .loom files detected. You can import one via Import .loom link.");
				}
			});
		}, () => {
			console.log("Unable to connect to BackendAPI");
		});
	}

	myLooms() {
		if(this.state.myLooms.length > 0) {
			return this.state.myLooms.map((loomFile) => {
				let icon = <Icon name="radio" />
				let active = loomFile.loomFilePath === this.state.activeLoom;
				if (active) {
					icon = <Icon name="selected radio" />
				}
				return (
					<Menu.Item active={active} key={loomFile.loomFilePath} onClick={() => this.setActiveLoom(loomFile.loomFilePath)}>{icon} {loomFile.loomFilePath}</Menu.Item>
				)
			});
		}
	}

	toggleUploadLoomModal(event) {
		this.setState({ uploadLoomModalOpened: !this.state.uploadLoomModalOpened })
	}

	toggleCpmNormization() {
		BackendAPI.setSetting('hasCpmNormalization', !this.state.settings.hasCpmNormalization);
		this.setState({settings: BackendAPI.getSettings()});
	}

	toggleLogTransform() {
		BackendAPI.setSetting('hasLogTransform', !this.state.settings.hasLogTransform);
		this.setState({settings: BackendAPI.getSettings()});
	}

	selectLoomFile(event, selection) {
		selection.forEach((selected) => {
			const [event, file] = selected;
			this.setState({ uploadLoomFile: file })
		})
	}

	uploadLoomFile() {
		let file = this.state.uploadLoomFile
		console.log(">", file)
		if (file == null) {
			alert("Please select a .loom file first")
			return
		}

		let form = new FormData();
		form.append('file', file);

		let xhr = new XMLHttpRequest();
		xhr.open('POST', 'http://localhost:50051/');
		xhr.upload.addEventListener('progress', (event) => {
			console.log("Data uploaded: " + event.loaded + "/" + event.total);
			let progress = (event.loaded / event.total * 100).toPrecision(1);
			this.setState({ uploadLoomProgress: progress });
			if (event.loaded == event.total) {
				console.log('Loom file '+ file.name +' successfully uploaded !');
				this.setState({ uploadLoomFile: null, uploadLoomProgress: 0 })
				this.updateMyLooms()
				this.toggleUploadLoomModal()
			}
		});
		xhr.setRequestHeader("Content-Disposition", "attachment;filename=" + file.name)
		xhr.send(form);
	}

	setActiveLoom(l) {
		this.setState({ activeLoom: l})
		BackendAPI.setActiveLoom(l);
		console.log(l +" is now active!")
	}
}
