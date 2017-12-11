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
                <Header as='h3'>Welcome to SCope</Header>
            </div>
        )
    }
}