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
			<Menu secondary attached="top" className="vib" inverted>
				<Menu.Item>
					<Icon name="sidebar" onClick={this.toggleSidebar.bind(this)} className="pointer" title="Toggle sidebar" />
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'welcome'} page='welcome'>
						<Icon name="home" />
						SCope
					</Button>
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'dataset'} page='dataset'>
						Dataset info
					</Button>
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'expression'} page='expression'>
						Gene expression
					</Button>
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'regulon'} page='regulon'>
						Regulon
					</Button>
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'comparison'} page='comparison'>
						Compare
					</Button>
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'dndcompare'} page='dndcompare'>
						DND Compare 
					</Button>
				</Menu.Item>
			</Menu>
		);
	}

	selectTab(evt, btn) {
		evt.preventDefault();
		this.props.togglePage(btn.page);
	}

	toggleSidebar() {
		this.props.toggleSidebar();
		let state = !this.state.sidebar;
		BackendAPI.setSidebarVisible(state);
		this.setState({sidebar: state});
	}

}