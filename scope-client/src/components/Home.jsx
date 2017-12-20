import React, { Component } from 'react';
import { Route } from 'react-router';
import { Switch, Router } from 'react-router-dom';
import { Sidebar, Segment, Button, Menu, Image, Icon, Header, Grid, Divider, Modal, Label, Progress } from 'semantic-ui-react'
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
        this.state = { sideBarVisible: true
                     , mainVisible: {"welcome":true, "viewer": false}
                     , slctdFeature: ""
                     , uploadLoomModalOpen: false
                     , uploadLoomInput: null
                     , uploadProgress: 0
                     , myLooms: []
                     , activeLoom: null
                     , dataPoints: []
        };
        this.GBC = require("grpc-bus-websocket-client");
        this.gbwcCxn = new this.GBC("ws://localhost:8081/", 'src/proto/s.proto', { scope: { Main: 'localhost:50052' } }).connect()
        this.updateMyLooms()
        this.changeTo = this.changeTo.bind(this);
        this.selectFeature = this.selectFeature.bind(this);
        this.updateUploadProgress = this.updateUploadProgress.bind(this);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    toggleVisibility = () => this.setState({ sideBarVisible: !this.state.sideBarVisible })

    updateMyLooms = () => {
        let query = {}
        this.gbwcCxn.then((gbc) => {
            gbc.services.scope.Main.getMyLooms(query, (err, response) => {
                if(response !== null)
                    this.setState({ myLooms: response.l })
                else 
                    console.log("No .loom files detected. You can import one via Import .loom link.")
            });
        });
    }

    updateUploadProgress = (p) => this.setState({ uploadProgress: p })

    uploadLoomFile = (e, d) => {
        let f = this.state.uploadLoomInput
        if(f == null)
            throw "Please select a .loom file first"
        let xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://localhost:50051/');
        xhr.upload.addEventListener('progress', (e) => {
            console.log("Data uploaded: " + e.loaded + "/" + e.total)
            let p = (e.loaded/e.total*100).toPrecision(1)
            this.updateUploadProgress(p)
            if(e.loaded == e.total) {
                console.log('Loom file,'+ f.name +', successfully uploaded !');
                this.setState({ uploadLoomInput: null, updateUploadProgress: 0 })
                this.handleOpenUploadLoomModal()
                // Update the loom list
                this.updateMyLooms()
            }
        });

        let form = new FormData();
        form.append('file', f);
        xhr.setRequestHeader("Content-Disposition", "attachment;filename=" + f.name)
        // xhr.setRequestHeader("Content-Type", "application/x-hdf")
        xhr.send(form);
    }

    selectLoomFile = (e, results) => {
        results.forEach(result => {
            const [e, file] = result;
            this.setState({ uploadLoomInput: file })
        })
    }

    setActiveLoom = (l) => {
        this.setState({ activeLoom: l})
        console.log(l +" is now active!")
    }

    changeTo = (p) => {
        let mv = this.state.mainVisible
        for (var key in mv) { mv[key] = false}
        mv[p] = true
        this.setState({ mainVisible: mv })
    }

    selectFeature = (f) => {
        this.setState({slctdFeature: f})
        console.log("Feature selected: "+f)
    }

    handleOpenUploadLoomModal = () => {
        this.setState({ uploadLoomModalOpen: !this.state.uploadLoomModalOpen })
    }
    

    render() {

        const header = { margin: 0 }
        const title = { fontSize: 14, width: 150 }
        const screenHeight = window.screen.availHeight
        const mainHeight = screenHeight - 100
        const sideBarWidth = 250

        let myLooms = () => {
            if(this.state.myLooms.length > 0)
                return this.state.myLooms.map(
                    (l) => {
                        let icon = ""
                        if(l === this.state.activeLoom)
                            icon = <Icon name="flag" />
                        return (<Menu.Item key={l} onClick={() => this.setActiveLoom(l)}>{l} {icon}</Menu.Item>)
                    }
                )
            else
                return (<Menu.Item key="none">No .loom files</Menu.Item>)
        }

        let progressBar = () => {
            let tools = []
            if(this.state.uploadProgress > 0) {
                return (
                    <Progress percent={this.state.uploadProgress} indicating progress></Progress>
                )
            }
        }

        let tools = () => {
            let tools = []
            if(this.state.activeLoom !== null) {
                tools.push(<Menu.Item key='viewer' name='Viewer' onClick={() => this.changeTo('viewer')}/>);
            }
            return (tools)
        }

        return (
            <div>
                <div style={header}>
                    <Menu secondary attached="top">
                        <Menu.Item onClick={() => this.setState({ sideBarVisible: !this.state.sideBarVisible })} style={{ width: 50 }} >
                            <Icon name="sidebar" />
                        </Menu.Item>
                        <Menu.Item style={title} style={{ width: 180 }}>
                            <Icon name="leaf" /> SCope
                        </Menu.Item>
                        <Menu.Item>
                            <QueryBox gbwccxn={this.gbwcCxn} selectfeature={ this.selectFeature } loom={this.state.activeLoom} />
                        </Menu.Item>
                    </Menu>
                    <Sidebar.Pushable style={{ minHeight: '96vh' }}>
                        <Sidebar as={Grid} style={{width: sideBarWidth}} animation='push' visible={this.state.sideBarVisible}>
                            <Menu vertical style={{width: sideBarWidth}}>
                                <Menu.Item onClick={() => this.changeTo('welcome')}>
                                    <Icon name='home'/>Home
                                </Menu.Item>
                                <Menu.Item>
                                    <Menu.Header>TOOLS</Menu.Header>
                                    <Menu.Menu>
                                        { tools() }
                                    </Menu.Menu>
                                    <Divider hidden />
                                    <Menu.Header>FCA DATASETS</Menu.Header>
                                    <Menu.Menu>
                                        {/* <Menu.Item name='Fly Brain' /> */}
                                    </Menu.Menu>
                                    <Divider hidden />
                                    <Menu.Header>MY DATASETS</Menu.Header>
                                    <Menu.Menu>
                                        { myLooms() }
                                        <Menu.Item onClick={() => this.handleOpenUploadLoomModal()}>
                                            <Icon name='attach'/>Import .loom
                                        </Menu.Item>
                                        <Modal open={this.state.uploadLoomModalOpen} onClose={() => this.handleOpenUploadLoomModal()} closeIcon>
                                            <Modal.Header>Import a .loom file</Modal.Header>
                                            <Modal.Content image>
                                                <Modal.Description>
                                                    <Label>Upload a File:</Label>{ this.state.uploadLoomInput != null ? this.state.uploadLoomInput.name : ""}
                                                    <FileReaderInput as="binary" id="my-file-input"
                                                        onChange={this.selectLoomFile}>
                                                        <Button>Select a file!</Button>
                                                    </FileReaderInput>
                                                    <Button onClick={this.uploadLoomFile}>Upload!</Button>
                                                    { progressBar() }
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
                                <Viewer width={window.screen.availWidth - 400} 
                                        height={window.screen.availHeight - 200} 
                                        maxp="200000"
                                        gbwccxn={this.gbwcCxn} 
                                        loom={this.state.activeLoom} 
                                        feature={this.state.slctdFeature}/>
                            </ToggleDisplay>
                        </Sidebar.Pusher>
                    </Sidebar.Pushable>
                </div>
            </div>
        );
    }
}

