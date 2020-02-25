import React, { Component } from 'react';
import { BackendAPI } from '../common/API';
import ReactJson from 'react-json-view';
import { Grid } from 'semantic-ui-react';

export default class Dataset extends Component {
  constructor() {
    super();
    this.state = {
      activeLoom: BackendAPI.getActiveLoom(),
      metadata: BackendAPI.getActiveLoomMetadata()
    };
    this.activeLoomListener = (loom, metadata) => {
      this.setState({ activeLoom: loom, metadata: metadata });
    };
  }

    render() {
        const { activeLoom, metadata } = this.state;

        return (
            <Grid>
                {!activeLoom && (
                    <Grid.Row>
                        <Grid.Column>
                            Select the dataset to be analyzed
                        </Grid.Column>
                    </Grid.Row>
                )}
                {activeLoom && (
                    <Grid.Row>
                        <Grid.Column>
                            Active loom file: <b>{activeLoom}</b>
                            <br />
                            <br />
                            <ReactJson src={metadata} collapsed={2} />
                        </Grid.Column>
                    </Grid.Row>
                )}
            </Grid>
        );
    }

  UNSAFE_componentWillMount() {
    BackendAPI.onActiveLoomChange(this.activeLoomListener);
  }

    componentWillUnmount() {
        BackendAPI.removeActiveLoomChange(this.activeLoomListener);
    }
}
