import _ from 'lodash'
import React, { Component } from 'react'
import { Header, Grid, Menu } from 'semantic-ui-react'
import { BackendAPI } from '../common/API' 

export default class ViewerToolbar extends Component {
    constructor() {
        super();
        this.state = {
            activeTool: BackendAPI.getViewerTool()
        }
    }

    render() {
        const { activeTool } = this.state;
        return (
            <Menu style={{position: "relative", top: 0, left: 0}} vertical fluid>
                <Menu.Item name='lasso' active={activeTool === 'lasso'} onClick={this.handleItemClick.bind(this)}>
                    <div title="Lasso Tool" style={{ display: "block", width: 20, height: 20, backgroundImage: 'url("src/images/lasso.svg")', backgroundSize: "cover" }}></div>
                </Menu.Item>
                <Menu.Item name='s-zoom' active={activeTool === 's-zoom'} onClick={this.handleItemClick.bind(this)}>
                    <div title="Semantic Zoom" style={{ display: "block", width: 20, height: 20, backgroundImage: 'url("src/images/expad-arrows.svg")', backgroundSize: "cover" }}></div>
                </Menu.Item>
                {/*
                <Menu.Item name='g-zoom' active={activeTool === 'g-zoom'} onClick={this.handleItemClick.bind(this)}>
                    <div title="Geometric Zoom" style={{ display: "block", width: 20, height: 20, backgroundImage: 'url("src/images/loupe.svg")', backgroundSize: "cover" }}></div>
                </Menu.Item>
                */}
            </Menu>
        );
    }

    handleItemClick(e, tool) {
        console.log("Setting active tool: ", tool.name);
        this.setState({ activeTool: tool.name });
        BackendAPI.setViewerTool(tool.name);
    } 
}
