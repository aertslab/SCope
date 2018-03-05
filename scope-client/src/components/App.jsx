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
			currentPage: BackendAPI.getActivePage()
		}
	}

	render() {
		return (
			<Segment className="parentView">
				<ReactResizeDetector handleHeight skipOnMount onResize={this.onResize.bind(this)} />
				<AppHeader toggleSidebar={this.toggleSidebar.bind(this)} togglePage={this.togglePage.bind(this)} currentPage={this.state.currentPage} />
				<Sidebar.Pushable>
					<AppSidebar currentPage={this.state.currentPage} visible={this.state.isSidebarVisible} />
					<Sidebar.Pusher>
						<AppContent currentPage={this.state.currentPage} />
					</Sidebar.Pusher>
				</Sidebar.Pushable>
			</Segment>
		);
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
