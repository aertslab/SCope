import React, { Component } from 'react';
import { Sidebar, Segment } from 'semantic-ui-react';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import AppContent from './AppContent';
import { BackendAPI } from './common/API';
import ReactResizeDetector from 'react-resize-detector';

export default class App extends Component {

	constructor() {
		super();
		this.state = {
			isSidebarVisible: true,
			currentPage: BackendAPI.getActivePage(),
			metadata: BackendAPI.getActiveLoomMetadata(),
		}
		this.activePageListener = (page) => {
			this.setState({currentPage: page})
		}

	}

	render() {
		return (
			<Segment className="parentView">
				<ReactResizeDetector handleHeight skipOnMount onResize={this.onResize.bind(this)} />
				<AppHeader toggleSidebar={this.toggleSidebar.bind(this)} togglePage={this.togglePage.bind(this)} currentPage={this.state.currentPage} metadata={this.state.metadata} />
				<Sidebar.Pushable>
					<AppSidebar currentPage={this.state.currentPage} visible={this.state.isSidebarVisible} handleLoomChange={this.handleLoomChange.bind(this)} />
					<Sidebar.Pusher>
						<AppContent currentPage={this.state.currentPage} />
					</Sidebar.Pusher>
				</Sidebar.Pushable>
			</Segment>
		);
	}

	componentWillMount() {
		BackendAPI.onActivePageChange(this.activePageListener);
	}

	componentWillUnmount() {
		BackendAPI.removeActivePageChange(this.activePageListener);
	}


	handleLoomChange(meta) {
		this.setState({metadata: meta})
	}

	toggleSidebar() {
		this.setState({isSidebarVisible: !this.state.isSidebarVisible});
	}

	togglePage(page) {
		if (DEBUG) console.log("togglePage", page);
		this.setState({currentPage: page});
		BackendAPI.setActivePage(page);
		BackendAPI.clearViewerSelections();
	}

	onResize() {
		this.forceUpdate();
	}

};
