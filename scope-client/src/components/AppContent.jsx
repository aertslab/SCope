import React, { Component } from 'react';
import { Segment, Header } from 'semantic-ui-react';
import Welcome from './pages/Welcome';
import Dataset from './pages/Dataset';
import Expression from './pages/Expression';
import Regulon from './pages/Regulon';
import Comparison from './pages/Comparison';
import { BackendAPI } from './common/API';

export default class AppContent extends Component {
	render () {
		return (
			<Segment style={{minHeight: window.innerHeight, width: '-260px'}}>
              	{this.props.currentPage == 'welcome' && <Welcome />}
              	{this.props.currentPage == 'dataset' && <Dataset />}
              	{this.props.currentPage == 'expression' && <Expression />}
              	{this.props.currentPage == 'regulon' && <Regulon />}
              	{this.props.currentPage == 'comparison' && <Comparison />}
            </Segment>
        );
	}
}
