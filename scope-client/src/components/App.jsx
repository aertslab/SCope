import React, { Component } from 'react';
import { Sidebar, Segment } from 'semantic-ui-react';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import AppContent from './AppContent';
import { BackendAPI } from './common/API';

export default class App extends Component {
	constructor() {
		super();
		this.state = {
			isSidebarVisible: true,
			currentPage: "welcome"
		}
	}
	render() {
		return (
			<Segment style={{minHeight: window.innerHeight}}>
				<AppHeader toggleSidebar={this.toggleSidebar.bind(this)} togglePage={this.togglePage.bind(this)} currentPage={this.state.currentPage} />
				<Sidebar.Pushable>
          			<AppSidebar visible={this.state.isSidebarVisible} />
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
		console.log("Switching to page", page);
		BackendAPI.clearViewerSelections();
		this.setState({currentPage: page});
	}

};
