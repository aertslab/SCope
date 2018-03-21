import React, { Component } from 'react';
import { withRouter, Link } from 'react-router-dom';
import { Segment,  Sidebar, Menu, Icon, Image, Divider,  Checkbox, Dropdown, Grid, Dimmer, Loader } from 'semantic-ui-react';
import { BackendAPI } from './common/API';
import UploadModal from './common/UploadModal';

class AppSidebar extends Component {

	constructor() {
		super();

		this.state = {
			activeCoordinates: BackendAPI.getActiveCoordinates(),
			settings: BackendAPI.getSettings(),
			loomFiles: [],
			uploadModalOpened: false,
			loading: true
		}
		this.uploadFileType = null;
	}

	render () {
		const { match } = this.props;
		const { activeCoordinates, settings, loading, loomFiles, uploadModalOpened } = this.state;
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
							<Menu.Item key="new" onClick={this.toggleUploadModal.bind(this)}>
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
				<UploadModal title="Import a .loom file" type='Loom' uuid={match.params.uuid} opened={uploadModalOpened} onClose={this.toggleUploadModal.bind(this)} />
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
					this.setState({loading: false});
					console.log("No loom files detected");
				}
			});
		}, () => {
			console.log("Unable to connect to BackendAPI");
		});
	}

	toggleUploadModal(event) {
		this.setState({ uploadModalOpened: !this.state.uploadModalOpened })
	}

	toggleCpmNormization() {
		BackendAPI.setSetting('hasCpmNormalization', !this.state.settings.hasCpmNormalization);
		this.setState({settings: BackendAPI.getSettings()});
	}

	toggleLogTransform() {
		BackendAPI.setSetting('hasLogTransform', !this.state.settings.hasLogTransform);
		this.setState({settings: BackendAPI.getSettings()});
	}

	setActiveCoordinates(evt, coords) {
		BackendAPI.setActiveCoordinates(coords.value);
		this.setState({ activeCoordinates: coords.value });
	}
}

export default withRouter(AppSidebar);