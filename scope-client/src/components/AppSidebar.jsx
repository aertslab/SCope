import React, { Component } from 'react';
import { withRouter, Link } from 'react-router-dom';
import { Segment,  Sidebar, Menu, Icon, Image, Button, Divider, Modal, Checkbox, Dropdown, Grid, Input, Progress, Dimmer, Loader } from 'semantic-ui-react';
import FileReaderInput from 'react-file-reader-input';
import { BackendAPI } from './common/API';

class AppSidebar extends Component {

	constructor() {
		super();

		this.state = {
			activeCoordinates: BackendAPI.getActiveCoordinates(),
			settings: BackendAPI.getSettings(),
			loomFiles: [],
			uploadLoomFile: null,
			uploadLoomModalOpened: false,
			uploadLoomProgress: 0,
			loading: true
		}
	}

	render () {
		const { match } = this.props;
		const { activeCoordinates, settings, loading, loomFiles } = this.state;
		let metadata = {}, coordinates = [];
		loomFiles.map(loomFile => {
			if (loomFile.loomFilePath == match.params.loom) {
				metadata = loomFile;
				coordinates = metadata.cellMetaData.embeddings.map(coords => {
					return {
						text: coords.name,
						value: coords.id
					}
				})
			}
		})
		let showTransforms = metadata && (['welcome','dataset'].indexOf(match.params.page) == -1) ? true : false;
		let showCoordinatesSelection = showTransforms && metadata.fileMetaData && metadata.fileMetaData.hasExtraEmbeddings ? true : false;

		return (
			<Sidebar as={Menu} animation="push" visible={this.props.visible} vertical className="clearfix">
					<Segment basic>
						<Icon name='arrow up' /><em>Hide me to get bigger workspace</em>
					</Segment>
					<Menu.Header>DATASETS</Menu.Header>
						<Menu.Menu>
							<Menu.Item key="new" onClick={this.toggleUploadLoomModal.bind(this)}>
								<Icon name="add" />
								<em>Upload new dataset</em>
							</Menu.Item>
							{loomFiles.map((loomFile, i) => {
								let active = match.params.loom == loomFile.loomFilePath;
								return (
									<Link key={i} to={'/' + [match.params.uuid, encodeURIComponent(loomFile.loomFilePath), encodeURIComponent(match.params.page)].join('/')} >
										<Menu.Item active={active} key={loomFile.loomFilePath} >
											<Icon name={active ? "selected radio" : "radio"} />
											{loomFile.loomDisplayName}
										</Menu.Item>
									</Link>
								);
							})}
							<Dimmer active={loading} inverted>
								<Loader inverted>Loading</Loader>
							</Dimmer>
						</Menu.Menu>
					<Divider />
					{(showTransforms || showCoordinatesSelection) &&
						<Menu.Header>SETTINGS</Menu.Header>
					}
					{showCoordinatesSelection &&
						<Menu.Menu>
							<Menu.Item>Coordinates</Menu.Item>
							<Menu.Item>
								<Dropdown inline defaultValue={activeCoordinates} options={coordinates} onChange={this.setActiveCoordinates.bind(this)} />
							</Menu.Item>
						</Menu.Menu>
					}
					{ showTransforms && 
						<Menu.Menu>
							<Menu.Item>Gene expression</Menu.Item>
							<Menu.Item>
								<Checkbox toggle label="Log transform" checked={settings.hasLogTransform} onChange={this.toggleLogTransform.bind(this)} />
							</Menu.Item>
							<Menu.Item>
								<Checkbox toggle label="CPM normalize" checked={settings.hasCpmNormalization} onChange={this.toggleCpmNormization.bind(this)} />
							</Menu.Item>
						</Menu.Menu>
					}
					<Divider />
					<Menu.Menu className="logos">
						{/*<Image src='src/images/kuleuven.png' size="small" centered href="http://kuleuven.be" />
						<br /><br />
						<Image src='src/images/vib.png' size="small" centered href="http://vib.be" />*/}
						<Image src='src/images/flycellatlas.png' size="small" centered href="http://flycellatlas.org/" />
					</Menu.Menu>
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

	componentWillMount() {
		this.getLoomFiles();
	}

	getLoomFiles() {
		const { match } = this.props;
		let query = {
			UUID: match.params.uuid
		};
		BackendAPI.getConnection().then((gbc) => {
			if (DEBUG) console.log("getMyLooms", query);
			gbc.services.scope.Main.getMyLooms(query, (error, response) => {
				if (response !== null) {
					if (DEBUG) console.log("getMyLooms", response);
					this.setState({ loomFiles: response.myLooms, loading: false });
					BackendAPI.setLoomFiles(response.myLooms);
					this.props.onMetadataChange(BackendAPI.getActiveLoomMetadata());
				} else {
					console.log("No .loom files detected. You can import one via Import .loom link.");
				}
			});
		}, () => {
			console.log("Unable to connect to BackendAPI");
		});
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
		const { match } = this.props;
		let file = this.state.uploadLoomFile

		if (file == null) {
			alert("Please select a .loom file first")
			return
		}

		let form = new FormData();
		form.append('UUID', match.params.uuid);
		form.append('file-type', 'Loom');
		form.append('file', file);

		let xhr = new XMLHttpRequest();
		xhr.open("POST", BACKEND.proto + "://" + BACKEND.host + ":" + BACKEND.XHRport + "/");
		xhr.upload.addEventListener('progress', (event) => {
			if (DEBUG) console.log("Data uploaded: " + event.loaded + "/" + event.total);
			let progress = (event.loaded / event.total * 100).toPrecision(1);
			this.setState({ uploadLoomProgress: progress });
		});
		xhr.upload.addEventListener('load', (event) => {
			if (DEBUG) console.log('Loom file '+ file.name +' successfully uploaded !');
			let query = {
				UUID: match.params.uuid,
				filename: file.name,
			};
			/*
			BackendAPI.getConnection().then((gbc) => {
				if (DEBUG) console.log("loomUploaded", query);
				gbc.services.scope.Main.loomUploaded(query, (error, response) => {
					if (DEBUG) console.log("loomUploaded", response);
					*/
					this.setState({ uploadLoomFile: null, uploadLoomProgress: 0 })
					this.getLoomFiles()
					this.toggleUploadLoomModal()
					/*
				})
			})
			*/
		})
		xhr.setRequestHeader("Content-Disposition", "attachment;filename=" + file.name)
		xhr.send(form);
	}

	setActiveCoordinates(evt, coords) {
		BackendAPI.setActiveCoordinates(coords.value);
		this.setState({ activeCoordinates: coords.value });
	}
}

export default withRouter(AppSidebar);