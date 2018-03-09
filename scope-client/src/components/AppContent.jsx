import React, { Component } from 'react';
import { Segment } from 'semantic-ui-react';
import Welcome from './pages/Welcome';
import Dataset from './pages/Dataset';
import Expression from './pages/Expression';
import Regulon from './pages/Regulon';
import DNDCompare from './pages/DNDCompare';

export default class AppContent extends Component {

	render () {

		return (
			<Segment style={{height: (window.innerHeight-85)+"px"}}>
				{/* TODO: remove css calculations */}
				{this.props.currentPage == 'welcome' && <Welcome />}
				{this.props.currentPage == 'dataset' && <Dataset />}
				{this.props.currentPage == 'expression' && <Expression />}
				{this.props.currentPage == 'regulon' && <Regulon />}
				{this.props.currentPage == 'dndcompare' && <DNDCompare />}
			</Segment>
		);

	}
}
