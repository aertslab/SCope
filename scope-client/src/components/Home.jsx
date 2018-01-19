import React, { Component } from 'react';
import { Route } from 'react-router';
import { Switch, Router } from 'react-router-dom';
import { Segment, Button, Menu, Image, Icon, Header, Grid, Divider, Modal, Label, Progress, Checkbox, Input } from 'semantic-ui-react'
import FileReaderInput from 'react-file-reader-input';
import ToggleDisplay from 'react-toggle-display';
import SplitPane from 'react-split-pane';
import styles from './styles.css';
// import { Row } from 'react-flexbox-grid';
import Sidebar from 'react-sidebar';

// SCope imports
import QueryBox from './QueryBox';
import Welcome from './Welcome';
import Viewer from './Viewer';

// https://github.com/styled-components/styled-components

export default class Home extends Component {

    constructor(props) {
        super(props);
        this.state = { sideBarVisible: true
                     , mainVisible: {"welcome":true, "sviewer": false, "rviewer": false}
                     , featureQuery: { i0: { type: "gene",value:"" }
                                     , i1: { type: "gene", value: "" }
                                     , i2: { type: "gene", value: "" } }
                     , uploadLoomModalOpen: false
                     , uploadLoomInput: null
                     , uploadProgress: 0
                     , myLooms: []
                     , activeLoom: null
                     , window: {
                         innerWidth: 0,
                         innerHeight: 0}
                     , settings: {
                        multiQueryOn: false
                     }
        };
        this.GBC = require("grpc-bus-websocket-client");
        this.gbwcCxn = new this.GBC("ws://localhost:8081/", 'src/proto/s.proto', { scope: { Main: 'localhost:50052' } }).connect()
        this.updateMyLooms()
        this.changeTo = this.changeTo.bind(this);
        this.selectFeatureValue = this.selectFeatureValue.bind(this);
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

    selectFeatureValue = (featureInputId, featureType, featureValue) => {
        this.setState({ featureQuery: {...this.state.featureQuery, ...{ [featureInputId]: { type: featureType, value: featureValue } } } })
        console.log("Feature value selected:"+ featureValue)
    }

    handleOpenUploadLoomModal = () => {
        this.setState({ uploadLoomModalOpen: !this.state.uploadLoomModalOpen })
    }

    componentDidMount() {
        // window.addEventListener('resize', () => {
        //     console.log(window.innerWidth)
        //     this.setState({ window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight } })
        // });
    }

    render() {

        const header = { margin: 0 }
        const title = { fontSize: 14, width: 150 }
        const leftSideBarWidth = 250, rightSidebarWidth = 200

        let mainWidth = () => {
            let w = window.innerWidth - rightSidebarWidth
            if(this.state.sideBarVisible)
                return w - leftSideBarWidth
            return w
        }

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
                tools.push(<Menu.Item key='sviewer' name='Simple Viewer' onClick={() => this.changeTo('sviewer')}/>);
                tools.push(<Menu.Item key='rviewer' name='Regulon Viewer' onClick={() => this.changeTo('rviewer')}/>);
            }
            return (tools)
        }

        let leftSidebarContent =  
            <Menu vertical style={{width: leftSideBarWidth, height: '100%'}}>
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
                        <Menu.Item name='Download' />
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
                                    <Grid.Row>
                                        <Input labelPosition='right'  type='text' placeholder={ this.state.uploadLoomInput != null ? this.state.uploadLoomInput.name : ""} action>
                                            <Label>Upload a File</Label>
                                            <input />
                                            <FileReaderInput as="binary" id="my-file-input"
                                                onChange={this.selectLoomFile}>
                                                <Button>Select a file!</Button>
                                            </FileReaderInput>
                                        </Input>
                                        {/* <Input style={{flex: 1}} label='Upload a File:' placeholder={ this.state.uploadLoomInput != null ? this.state.uploadLoomInput.name : ""} /> */}
                                        <Button onClick={this.uploadLoomFile}>Upload!</Button>
                                    </Grid.Row>
                                    <Grid.Row>
                                        { progressBar() }
                                    </Grid.Row>
                                </Modal.Description>
                            </Modal.Content>
                        </Modal>
                        {/* <Menu.Item>
                            <Icon name='linkify' />Url .loom
                        </Menu.Item> */}
                    </Menu.Menu>
                    <Divider hidden />
                    <Menu.Header>SETTINGS</Menu.Header>
                    <Menu.Menu>
                        <Menu.Item>
                            <div style={{display: 'inline-block', marginTop: 2}}>Multi query</div>
                            <Checkbox checked={this.state.settings.multiQueryOn} 
                                    toggle 
                                    style={{marginLeft: 5, float: 'right'}} 
                                    onChange={(e,d) => this.setState({ settings: { multiQueryOn: d.checked} })}/>
                        </Menu.Item>
                    </Menu.Menu>
                </Menu.Item>
            </Menu>

        let rightSidebarContent = 
            <Menu vertical style={{height: '100%'}}>
                <Menu.Item>
                    <Menu.Header>CELL SELECTIONS</Menu.Header>
                    <Icon name='home'/>Home
                </Menu.Item>
            </Menu>
        
        return (
            <div>
                <div style={header}>
                    <Menu secondary attached="top">
                        <Menu.Item onClick={() => this.setState({ sideBarVisible: !this.state.sideBarVisible })} style={{ width: 50 }} >
                            <Icon name="sidebar" />
                        </Menu.Item>
                        <Menu.Item style={title} style={{ width: 180 }}>
                            <Icon name="leaf" />SCope
                        </Menu.Item>
                        <Menu.Item>
                            <QueryBox gbwccxn={this.gbwcCxn} 
                                      homeref={this} 
                                      loom={this.state.activeLoom} 
                                      multiqueryon={this.state.settings.multiQueryOn.toString()}/>
                        </Menu.Item>
                    </Menu>
                    <Sidebar sidebar={leftSidebarContent}
                        styles={{root: {top: 64}}}
                        open={this.state.sideBarVisible}
                        docked={this.state.sideBarVisible}>
                        <Sidebar sidebar={rightSidebarContent}
                            styles={{sidebar: {width: 200, overflow: 'hidden'}, content: {overflow: 'hidden'}}}
                            open={true}
                            docked={true}
                            pullRight={true}
                            shadow={true}>
                            <div style={{padding: 10}}>
                                <ToggleDisplay show={this.state.mainVisible["welcome"]}>
                                    <Welcome/>
                                </ToggleDisplay>
                                <ToggleDisplay show={this.state.mainVisible["sviewer"]}> 
                                    <Viewer width={mainWidth()} 
                                        height={window.innerHeight} 
                                        maxp="200000"
                                        gbwccxn={this.gbwcCxn} 
                                        loom={this.state.activeLoom} 
                                        featureQuery={this.state.featureQuery}
                                        multiqueryon={this.state.settings.multiQueryOn.toString()} />
                                </ToggleDisplay>
                                <ToggleDisplay show={this.state.mainVisible["rviewer"]}>
                                    <Segment basic style={{width: mainWidth(), height: window.innerHeight-70}}>
                                        <SplitPane split="vertical" percentage defaultSize="50%">
                                            <div>
                                                <SplitPane split="horizontal" percentage defaultSize="50%">
                                                    <div>TOP LEFT</div>
                                                    <div>BOTTOM LEFT</div>
                                                </SplitPane>
                                            </div>
                                            <div>
                                                <SplitPane split="horizontal" percentage defaultSize="50%">
                                                <div>TOP RIGHT</div>
                                                <div>BOTTOM RIGHT</div>
                                                </SplitPane>
                                            </div>
                                        </SplitPane>
                                    </Segment>
                                </ToggleDisplay>
                            </div>
                        </Sidebar>
                    </Sidebar>
                </div>
            </div>
        );
    }
}

