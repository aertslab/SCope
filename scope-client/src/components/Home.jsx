import React, { Component } from 'react';
import { Route } from 'react-router';
import { Switch, Router } from 'react-router-dom';
import { Sidebar, Segment, Button, Menu, Image, Icon, Header, Grid, Divider, Modal, Label } from 'semantic-ui-react'
import FileReaderInput from 'react-file-reader-input';
import ToggleDisplay from 'react-toggle-display';
// SCope imports
import QueryBox from './QueryBox';
import Welcome from './Welcome';
import Viewer from './Viewer';

// https://github.com/styled-components/styled-components

export default class Home extends Component {

    constructor(props) {
        super(props);
        this.state = {
            sideBarVisible: true,
            mainVisible: {"welcome":true, "viewer": false},
            slctdFeature: ""
        };
        this.GBC = require("grpc-bus-websocket-client");
        this.gbwcCxn = new this.GBC("ws://localhost:8081/", 'src/proto/s.proto', { scope: { Main: 'localhost:50052' } }).connect()
        this.changeTo = this.changeTo.bind(this);
        this.selectFeature = this.selectFeature.bind(this);
    }

    toggleVisibility = () => this.setState({ sideBarVisible: !this.state.sideBarVisible })

    uploadLoomFile = (e, results) => {
        results.forEach(result => {
            const [e, file] = result;
            console.log(file)
            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'http://localhost:50051/');
            xhr.upload.addEventListener('progress', function (e) {
                console.log("Data uploaded: " + e.loaded + "/" + e.total)
                // progress.value = e.loaded;
                // progress.max = e.total;
            });

            xhr.addEventListener('load', function () {
                alert('Loom file successfully uploaded !');
            });

            var form = new FormData();
            form.append('file', file);
            console.log(file.name)
            xhr.setRequestHeader("Content-Disposition", "attachment;filename=" + file.name)
            xhr.send(form);
        });
    }

    changeTo = (p) => {
        let mv = this.state.mainVisible
        for (var key in mv) { mv[key] = false}
        mv[p] = true
        this.setState({ mainVisible: mv })
    }

    selectFeature = (f) => {
        this.setState({slctdFeature: f})
        console.log("Feature: "+f)
    }

    render() {

        const header = { margin: 0 }
        const title = { fontSize: 14, width: 150 }
        const screenHeight = window.screen.availHeight
        const mainHeight = screenHeight - 100

        return (
            <div>
                <div style={header}>
                    <Menu secondary attached="top">
                        <Menu.Item onClick={() => this.setState({ sideBarVisible: !this.state.sideBarVisible })} style={{ width: 50 }} >
                            <Icon name="sidebar" />
                        </Menu.Item>
                        <Menu.Item style={title}>
                            <Icon name="leaf" /> SCope
                        </Menu.Item>
                        <Menu.Item>
                            <QueryBox gbwccxn={this.gbwcCxn} selectfeature={ this.selectFeature }/>
                        </Menu.Item>
                    </Menu>
                    <Sidebar.Pushable style={{ minHeight: '96vh' }}>
                        <Sidebar as={Grid} animation='push' width="thin" visible={this.state.sideBarVisible}>
                            <Menu vertical>
                                <Menu.Item onClick={() => this.changeTo('welcome')}>
                                    <Icon name='home'/>Home
                                </Menu.Item>
                                <Menu.Item>
                                    <Menu.Header>TOOLS</Menu.Header>
                                    <Menu.Menu>
                                        <Menu.Item name='Viewer' onClick={() => this.changeTo('viewer')}/>
                                    </Menu.Menu>
                                    <Divider hidden />
                                    <Menu.Header>FCA DATASETS</Menu.Header>
                                    <Menu.Menu>
                                        <Menu.Item name='Fly Brain' />
                                    </Menu.Menu>
                                    <Divider hidden />
                                    <Menu.Header>MY DATASETS</Menu.Header>
                                    <Menu.Menu>
                                        <Modal trigger={<Menu.Item><Icon name='attach' />Import .loom</Menu.Item>}>
                                            <Modal.Header>Import a .loom file</Modal.Header>
                                            <Modal.Content image>
                                                <Modal.Description>
                                                    <Label>Upload a File:</Label>
                                                    <FileReaderInput as="binary" id="my-file-input"
                                                        onChange={this.uploadLoomFile}>
                                                        <Button>Select a file!</Button>
                                                    </FileReaderInput>
                                                    <Button>Upload!</Button>
                                                </Modal.Description>
                                            </Modal.Content>
                                        </Modal>
                                        {/* <Menu.Item>
                                            <Icon name='linkify' />Url .loom
                                        </Menu.Item> */}
                                    </Menu.Menu>
                                </Menu.Item>
                            </Menu>
                        </Sidebar>
                        <Sidebar.Pusher>
                            <ToggleDisplay show={this.state.mainVisible["welcome"]}>
                                <Welcome/>
                            </ToggleDisplay>
                            <ToggleDisplay show={this.state.mainVisible["viewer"]}>
                                <Viewer feature={this.state.slctdFeature}/>
                            </ToggleDisplay>
                        </Sidebar.Pusher>
                    </Sidebar.Pushable>
                </div>
            </div>
        );
    }
}

