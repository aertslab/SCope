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
		const { metadata, currentPage, togglePage } = this.props;
		console.log(currentPage);
		let infoTab = () => {
			if (metadata) return (
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={currentPage == 'dataset'} page='dataset'>
						Dataset info
					</Button>
				</Menu.Item>
			);
			else if (currentPage == 'dataset') {
				togglePage('welcome');
			}
		}
		let geneTab = () => {
			if (metadata) return (
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={currentPage == 'expression'} page='expression'>
						Gene expression
					</Button>
				</Menu.Item>
			);
			else if (currentPage == 'expression') {
				togglePage('welcome');
			}
		}

		let regulonTab = () => {
			if (metadata && metadata.fileMetaData.hasRegulonsAUC) return (
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={currentPage == 'regulon'} page='regulon'>
						Regulon
					</Button>
				</Menu.Item>
			);
			else if (currentPage == 'regulon') {
				togglePage('welcome');
			}
		}

		let compare1DNDTab = () => {
			if (metadata && metadata.cellMetaData && metadata.cellMetaData.annotations.length) return (
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={currentPage == 'dndcompare'} page='dndcompare'>
						Compare
					</Button>
				</Menu.Item>
			);
			else if (currentPage == 'dndcompare') {
				togglePage('welcome');
			}
		}

		return (
			<Menu secondary attached="top" className="vib" inverted>
				<Menu.Item>
					<Icon name="sidebar" onClick={this.toggleSidebar.bind(this)} className="pointer" title="Toggle sidebar" />
				</Menu.Item>
				<Menu.Item>
					<Button basic onClick={this.selectTab.bind(this)} active={currentPage == 'welcome'} page='welcome'>
						<Icon name="home" />
						SCope
					</Button>
				</Menu.Item>
				{infoTab()}
				{geneTab()}
				{regulonTab()}
				{compare1DNDTab()}
			</Menu>
		);
	}

	componentWillReceiveProps(nextProps) {
		this.props = nextProps;
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