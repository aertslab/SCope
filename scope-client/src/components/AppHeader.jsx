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
		const { metadata } = this.props;

		let infoTab = () => {
			if (metadata) return (
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'dataset'} page='dataset'>
						Dataset info
					</Button>
				</Menu.Item>
			);
		}
		let geneTab = () => {
			if (metadata) return (
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'expression'} page='expression'>
						Gene expression
					</Button>
				</Menu.Item>
			);
		}

		let regulonTab = () => {
			if (metadata && metadata.fileMetaData.hasRegulonsAUC) return (
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'regulon'} page='regulon'>
						Regulon
					</Button>
				</Menu.Item>
			);
		}

		let compare1Tab = () => {
			if (metadata && metadata.cellMetaData && metadata.cellMetaData.annotations.length) return (
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'comparison'} page='comparison'>
						Compare
					</Button>
				</Menu.Item>
			);
		}

		let compare2Tab = () => {
			if (metadata && metadata.cellMetaData && metadata.cellMetaData.annotations.length) return (
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={this.props.currentPage == 'dndcompare'} page='dndcompare'>
						DND Compare 
					</Button>
				</Menu.Item>
			);
		}


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
				{infoTab()}
				{geneTab()}
				{regulonTab()}
				{compare1Tab()}
				{compare2Tab()}
			</Menu>
		);
	}

	componentWillReceiveProps() {
		this.forceUpdate();
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