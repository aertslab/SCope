import React, { Component } from 'react'
import { Header } from 'semantic-ui-react'


export default class Welcome extends Component {

    constructor(props) {
        super(props)
    }

    componentWillUnmount() {
    }

    render() {
        return (
            <div style={{margin: 10}}>
                <Header as='h1'>Welcome to SCope</Header>
                <br/>
                SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.
                <br/>
                Currently the format of the datasets supported by SCope is <i>.loom</i>.
            </div>
        )
    }
}