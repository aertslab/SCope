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

        let querySearchLabel = {
            position: 'relative',
            top: 1, 
            left: 15, 
            height: 38
        }
    
        let noJitter = {
            padding: 0
        }

        let hideLabel = () => {
            if(this.isMultiQueryOn())
                return "block"
            return "none"
        }

        let multiQueryInputs = [...Array((this.isMultiQueryOn() ? 3 : 1)).keys()].map((i) => {
            let key = "i"+ i
            return (
                <Menu.Item key={key} style={noJitter}>
                    <Menu secondary style={noJitter}>
                        <Menu.Item style={{padding: 0, display: hideLabel()}}>
                            <Label color={this.colors[i]} style={querySearchLabel}></Label>
                        </Menu.Item>
                        <Menu.Item style={noJitter}>
                            <QuerySearch key={key} id={key} color={this.colors[i]} {...this.props}/>
                        </Menu.Item>
                    </Menu>
                </Menu.Item>
            )
        })

        let searchButton = () => {
            if(this.isMultiQueryOn()) 
                return (
                    <Menu.Item style={noJitter}>
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