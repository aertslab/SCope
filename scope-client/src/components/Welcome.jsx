import React, { Component } from 'react'
import { Header } from 'semantic-ui-react'
import SplitLayout from 'react-split-pane'

export default class Welcome extends Component {

    constructor(props) {
        super(props)
    }

    componentWillUnmount() {
    }

    render() {
        return (
            <div style={{margin: 10}}>
                <div style={{height: '400'}}>
                <Header as='h1'>Welcome to SCope</Header>
                <br/>
                SCope is a fast visualization tool for large-scale and high dimensional scRNA-seq datasets.
                <br/>
                Currently the format of the datasets supported by SCope is <i>.loom</i>.
                </div>
            </div>
        )
    }
}