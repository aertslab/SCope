import React, { Component } from 'react';
import { Sidebar, Menu, Icon, Image, Button, Divider, Modal, Checkbox, Dropdown, Grid, Input, Progress } from 'semantic-ui-react';
import FileReaderInput from 'react-file-reader-input';
import { BackendAPI } from './common/API';

export default class AppSidebar extends Component {

	constructor() {
		super();

		this.state = {
			activeLoom: BackendAPI.getActiveLoom(),
			activeCoordinates: BackendAPI.getActiveCoordinates(),
			metadata: BackendAPI.getActiveLoomMetadata(),
			settings: BackendAPI.getSettings(),
			myLooms: [],
			uploadLoomFile: null,
			uploadLoomModalOpened: false,
			uploadLoomProgress: 0,
		}
		this.updateMyLooms();
	}

	render () {

		const { activeCoordinates, metadata, settings } = this.state;
		let showCoordinatesSelection = metadata && metadata.fileMetaData.hasExtraEmbeddings && (['expression', 'regulon', 'comparison'].indexOf(this.props.currentPage) != -1) ? true : false;
		let showTransforms = this.props.currentPage == 'expression' ? true : false;

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
					<Menu.Header style={{display:  showTransforms || showCoordinatesSelection ? 'block' : 'none'}} >SETTINGS</Menu.Header>
					<Menu.Menu style={{display: showCoordinatesSelection ? 'block' : 'none'}}>
						<Menu.Item>
						<Dropdown placeholder="Select coordinates ID" labeled fluid  text={activeCoordinates.name} >
							<Dropdown.Menu>
								{this.myLoomCoordinates()}
							</Dropdown.Menu>
						</Dropdown>
						</Menu.Item>
					</Menu.Menu>
					<Menu.Menu style={{display:  showTransforms ? 'block' : 'none'}}>
						<Menu.Item>
							<Checkbox toggle label="Log transform" checked={settings.hasLogTransform} onChange={this.toggleLogTransform.bind(this)} />
						</Menu.Item>
						<Menu.Item>
							<Checkbox toggle label="CPM normalize" checked={settings.hasCpmNormalization} onChange={this.toggleCpmNormization.bind(this)} />
						</Menu.Item>
					</Menu.Menu>
					<Divider />
					<Menu.Menu className="logos">
						<Image src='src/images/kuleuven.png' size="small" centered href="http://kuleuven.be" />
						<br /><br />
						<Image src='src/images/vib.png' size="small" centered href="http://vib.be" />
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
					if (DEBUG) console.log("updateMyLooms", response.myLooms);
					this.setState({ myLooms: response.myLooms });
					BackendAPI.setLoomFiles(response.myLooms);
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

	myLoomCoordinates() {
		const { activeCoordinates, metadata } = this.state;
		if (metadata && metadata.cellMetaData) {
			return metadata.cellMetaData.embeddings.map((coords) => {
				return (
					<Dropdown.Item key={coords.id} text={coords.name} value={coords.id} active={activeCoordinates.id == coords.id} onClick={this.setActiveCoordinates.bind(this)} />
				);
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
		if (DEBUG) console.log(">", file)
		if (file == null) {
			alert("Please select a .loom file first")
			return
		}

		let form = new FormData();
		form.append('file', file);

		let xhr = new XMLHttpRequest();
		xhr.open("POST", "http://" + BACKEND.host + ":" + BACKEND.XHRport + "/");
		xhr.upload.addEventListener('progress', (event) => {
			if (DEBUG) console.log("Data uploaded: " + event.loaded + "/" + event.total);
			let progress = (event.loaded / event.total * 100).toPrecision(1);
			this.setState({ uploadLoomProgress: progress });
			if (event.loaded == event.total) {
				if (DEBUG) console.log('Loom file '+ file.name +' successfully uploaded !');
				this.setState({ uploadLoomFile: null, uploadLoomProgress: 0 })
				this.updateMyLooms()
				this.toggleUploadLoomModal()
			}
		});
		xhr.setRequestHeader("Content-Disposition", "attachment;filename=" + file.name)
		xhr.send(form);
	}

	setActiveLoom(l) {
		if (DEBUG) console.log('setActiveLoom', l);
		BackendAPI.setActiveCoordinates(-1);
		BackendAPI.setActiveLoom(l);
		let metadata = BackendAPI.getActiveLoomMetadata();
		this.setState({ activeLoom: l, metadata: metadata})
		if (metadata.fileMetaData.hasExtraEmbeddings) {
			this.setState({ activeCoordinates: metadata.cellMetaData.embeddings[0] });
		} else {
			this.setState({ activeCoordinates: { id: -1, name: '' }});
		}
	}

	setActiveCoordinates(evt, coords) {
		BackendAPI.setActiveCoordinates(coords.value);
		this.setState({ activeCoordinates: { id: coords.value, name: coords.text }});
	}
}
