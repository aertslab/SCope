import React, { Component, PropTypes } from 'react'
import { Segment, Search, Label, Menu, Button } from 'semantic-ui-react'
import QuerySearch from './QuerySearch';

export default class QueryBox extends React.Component {

    constructor(props) {
        super(props)
        this.colors = ["red","green","blue"]
    }

    isMultiQueryOn = () => {
        return this.props.multiqueryon === "true"
    }

    render() {
        let multiQueryInputs = [...Array((this.isMultiQueryOn() ? 3 : 1)).keys()].map((i) => {
            let key = "i"+ i
            return (
                <Menu.Item key={key} style={{padding: 0}}>
                    <QuerySearch key={key} color={this.colors[i]} {...this.props}/>
                </Menu.Item>
            )
        })
        let searchButton = () => {
            if(this.isMultiQueryOn()) 
                return (
                    <Menu.Item style={{padding: 0}}>
                        <Button type='submit' icon='search'></Button>
                    </Menu.Item>
                )
        }

        return (
            <Menu secondary style={{padding: 0}}>
                { multiQueryInputs }
                { searchButton() }
            </Menu>
        );
    }

}