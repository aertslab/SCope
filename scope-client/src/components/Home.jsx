import React, { Component } from 'react';
import { Route } from 'react-router';
import { Switch, Router } from 'react-router-dom';
import { Segment, Button, Menu, Image, Icon, Header, Grid, Divider, Modal, Label, Progress, Checkbox, Input } from 'semantic-ui-react'
import FileReaderInput from 'react-file-reader-input';
import ToggleDisplay from 'react-toggle-display';
import SplitPane from 'react-split-pane';
import styles from './styles.css';
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
                     , lassoSelections: []
                     , uploadLoomModalOpen: false
                     , uploadLoomInput: null
                     , uploadProgress: 0
                     , myLooms: []
                     , activeLoom: null
                     , window: {
                         innerWidth: 0,
                         innerHeight: 0}
                     , multiQueryOn: false
                     , logTransform: true
                     , cpmNormalise: false

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
                    this.setState({ myLooms: response.loomFilePath })
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

    getRandomColor() {
        var letters = '0123456789ABCDEF';
        var color = '';
        for (var i = 0; i < 6; i++) {
          color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    selectLassoSelection(id) {
        let lassoSelections = this.state.lassoSelections.map((lS) => {
            if(lS.id == id)
                lS.selected = !lS.selected
            return lS
        })
        this.setState({ lassoSelections: lassoSelections })
        this.viewer.highlightPointsInLasso()
    }

    unSelectAllLassoSelections() {
        let lassoSelections = this.state.lassoSelections.map((lS) => {
            lS.selected = false
            return lS
        })
        this.setState({ lassoSelections: lassoSelections })
    }

    addLassoSelection(lassoPoints) {
        this.unSelectAllLassoSelections()
        let lassoSelection = { id: this.state.lassoSelections.length == 0 ? 0: this.state.lassoSelections.length
                             , selected: true
                             , color: this.getRandomColor()
                             , points: lassoPoints
        }
        this.setState({ lassoSelections: [...this.state.lassoSelections, lassoSelection] })
        return lassoSelection
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
        const leftSideBarWidth = 250, rightSidebarWidth = 300

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

        let lassoSelections = () => {
            if(this.state.lassoSelections.length == 0)
                return (<Grid><Grid.Column>No user's lasso selections</Grid.Column></Grid>)
            return (this.state.lassoSelections.map((lS) => {
                    return (<Grid key={lS.id}>
                        <Grid.Column style={{width: 20, marginLeft: 5, marginRight: 5, padding: 2}}>
                            <Checkbox checked={lS.selected} onChange={(e,d) => this.selectLassoSelection(lS.id)}/>
                        </Grid.Column>
                        <Grid.Column style={{width: 110, padding: 2}}>
                            {"Selection "+ lS.id}
                        </Grid.Column>
                        <Grid.Column style={{width: 100, padding: 2}}>
                            <Input
                                size='mini'
                                style={{width: 75, height: 10}}
                                label={{ style: {backgroundColor: '#'+lS.color } }}
                                labelPosition='right'
                                placeholder={'#'+lS.color}
                            />
                        </Grid.Column>
                        <Grid.Column style={{padding: 2}}>
                            <Icon name='eye' style={{display: 'inline'}}/>
                            <Icon name='trash' style={{display: 'inline'}}/>
                            <Icon name='download' style={{display: 'inline'}}/>
                        </Grid.Column>
                    </Grid>)}))
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
                            <Checkbox checked={this.state.multiQueryOn}
                                      toggle
                                      style={{marginLeft: 5, float: 'right'}}
                                      onChange={(e,d) => this.setState({ multiQueryOn: d.checked} )}/>
                        </Menu.Item>
                        <Menu.Item>
                            <div style={{display: 'inline-block', marginTop: 2}}>Log Transform</div>
                            <Checkbox checked={this.state.logTransform}
                                      toggle
                                      style={{marginLeft: 5, float: 'right'}}
                                      onChange={(e,d) => this.setState({ logTransform: d.checked} )}/>
                        </Menu.Item>
                        <Menu.Item>
                            <div style={{display: 'inline-block', marginTop: 2}}>CPM Normalise</div>
                            <Checkbox checked={this.state.cpmNormalise}
                                      toggle
                                      style={{marginLeft: 5, float: 'right'}}
                                      onChange={(e,d) => this.setState({ cpmNormalise: d.checked} )}/>
                        </Menu.Item>
                    </Menu.Menu>
                </Menu.Item>
            </Menu>

        let rightSidebarContent =
            <Menu vertical style={{width: rightSidebarWidth, height: '100%'}}>
                <Menu.Item>
                    <Menu.Header style={{marginBottom: 25}}>CELL SELECTIONS</Menu.Header>
                    { lassoSelections() }
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
                                      multiqueryon={this.state.multiQueryOn.toString()}/>
                        </Menu.Item>
                    </Menu>
                    <Sidebar sidebar={leftSidebarContent}
                        styles={{root: {top: 64}}}
                        open={this.state.sideBarVisible}
                        docked={this.state.sideBarVisible}>
                        <Sidebar sidebar={rightSidebarContent}
                            styles={{sidebar: {overflow: 'hidden'}, content: {overflow: 'hidden'}}}
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
                                        homeref={this}
                                        ref={instance => { this.viewer = instance; }}
                                        loom={this.state.activeLoom}
                                        featureQuery={this.state.featureQuery}
                                        multiqueryon={this.state.multiQueryOn.toString()}
                                        logtransform={this.state.logTransform}
                                        cpmnormalise={this.state.cpmNormalise} />
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
