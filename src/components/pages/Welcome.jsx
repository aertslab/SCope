import React, { Component } from 'react';
import { Grid, Header } from 'semantic-ui-react';

export default class Welcome extends Component {

    render() {
        return (
            <Grid>
                <Grid.Row>
                    <Grid.Column>
                        <Header as='h1'>Welcome to SCope</Header>
                        SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.<br />
                        Currently the format of the datasets supported by SCope is <i>.loom</i>.
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        )
    }
}
