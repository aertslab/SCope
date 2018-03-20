import React, { Component } from 'react'
import { Grid, Header } from 'semantic-ui-react'

export default class Regulon extends Component {

    render() {
        return (
            <Grid>
                <Grid.Row>
                    <Grid.Column>
                        <Header as='h1'>SCope tutorial</Header>
                        Soon we will make a nice tutorial with videos and howto's.<br />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}