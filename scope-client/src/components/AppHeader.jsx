import React, { Component } from 'react';
import { Icon, Button, Menu } from 'semantic-ui-react';
import { BackendAPI } from './common/API';

export default class AppHeader extends Component {
	constructor() {
		super();
		this.state = {
			sidebar: true
		}
	}

	render() {
		return (
			<Menu secondary attached="top" style={{backgroud: 'blue'}} className="vib" inverted>
				<Menu.Item>
					<Icon name="sidebar" onClick={this.toggleSidebar.bind(this)} style={{cursor: 'pointer'}} title="Toggle sidebar" />
				</Menu.Item>
				<Menu.Item>					
					<Button basic onClick={this.selectWelcomeTab.bind(this)} active={this.props.currentPage == 'welcome'}>
						<Icon name="home" />
						SCope
					</Button>
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectDatasetTab.bind(this)} active={this.props.currentPage == 'dataset'}>
						Dataset info
					</Button>
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectExpressionTab.bind(this)} active={this.props.currentPage == 'expression'}>
						Gene expression
					</Button>
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectRegulonTab.bind(this)} active={this.props.currentPage == 'regulon'}>
						Regulon
					</Button>
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectComparisonTab.bind(this)} active={this.props.currentPage == 'comparison'}>
						Compare
					</Button>
				</Menu.Item>
			</Menu>
		);
	}

	toggleSidebar() {
		this.props.toggleSidebar();
		let state = !this.state.sidebar;
		BackendAPI.setSidebarVisible(state);
		this.setState({sidebar: state});
	}

	selectWelcomeTab(e) {
		e.preventDefault();
		this.props.togglePage("welcome");
	}

	selectExpressionTab(e){
		e.preventDefault();
		this.props.togglePage("expression");
	}

	selectRegulonTab(e){
		e.preventDefault();
		this.props.togglePage("regulon");
	}

	selectDatasetTab(e){
		e.preventDefault();
		this.props.togglePage("dataset");
	}

	selectComparisonTab(e){
		e.preventDefault();
		this.props.togglePage("comparison");
	}

}