import React, { Component } from 'react';
import { Icon, Button, Menu } from 'semantic-ui-react';

export default class AppHeader extends Component {
	render() {
		return (
			<Menu secondary attached="top">
				<Menu.Item>
					<Icon name="sidebar" onClick={this.toggleSidebar.bind(this)} />
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
				{/*
				<Menu.Item>
					<Button basic onClick={this.selectComparisonTab.bind(this)} active={this.props.currentPage == 'comparison'}>
						Compare
					</Button>
				</Menu.Item>
			*/}
			</Menu>
		);
	}

	toggleSidebar() {
		this.props.toggleSidebar();
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