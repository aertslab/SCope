import React, { Component } from 'react';
import { Route } from 'react-router-dom';
import { Segment } from 'semantic-ui-react';
import Welcome from './pages/Welcome';
import Dataset from './pages/Dataset';
import Expression from './pages/Expression';
import Regulon from './pages/Regulon';
import Compare from './pages/Compare';
import Tutorial from './pages/Tutorial';

export default class AppContent extends Component {
  render() {
    return (
      <Segment style={{ height: window.innerHeight - 85 + 'px' }}>
        {/* TODO: remove css calculations */}
        <Route path='/:uuid/:loom?/welcome' component={Welcome} />
        <Route path='/:uuid/:loom?/dataset' component={Dataset} />
        <Route path='/:uuid/:loom?/gene' component={Expression} />
        <Route path='/:uuid/:loom?/regulon' component={Regulon} />
        <Route path='/:uuid/:loom?/compare' component={Compare} />
        <Route path='/:uuid/:loom?/tutorial' component={Tutorial} />
      </Segment>
    );
  }
}
