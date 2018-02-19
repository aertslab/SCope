import React, { Component } from 'react'
import * as PIXI from 'pixi.js'
import * as d3 from 'd3';
import {  Menu, Grid,  Checkbox, Input, Icon  } from 'semantic-ui-react'
import { BackendAPI } from './API' 

export default class TSNEViewer extends Component {

    constructor(props) {
        super(props)
        this.state = { 
            coord : {
                x: [],
                y: []
            },
            lassoPoints: [],
            lassoSelections: [],
            mouse: { 
                down: false 
            },
            zoom: { 
                type: 's',
                k : 1,
                transform : null
            },
            activeTool: 's-zoom',
            benchmark: { 
                t1: 0, 
                msg: "" 
            }
        }
        this.w = parseInt(this.props.width);
        this.h = parseInt(this.props.height);
        this.maxn = 200000;
        this.texture = PIXI.Texture.fromImage("src/images/particle@2x.png");
        BackendAPI.onSettingsChange(() => {
            this.getFeatureColors(this.props.activeFeatures, this.props.loomFile);
        })
    }

    render() {

        const { activeTool } = this.state

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

        return (
            <Grid>
                <Grid.Row>
                <Grid.Column width={1}>
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
                </Grid.Column>
                <Grid.Column width={10}>
                    <canvas id="viewer" style={{width: 100+'%'}}></canvas>
                </Grid.Column>
                <Grid.Column width={2}>
                    {lassoSelections()}
                </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }

    componentWillMount() {
        if (this.props.loomFile != null) {
            this.getPoints(this.props.loomFile, () => {
                this.getFeatureColors(this.props.activeFeatures, this.props.loomFile);
            });
        }
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.loomFile != nextProps.loomFile) {            
            this.getPoints(nextProps.loomFile, () => {
                this.getFeatureColors(nextProps.activeFeatures, nextProps.loomFile);
            });
        } else {
            this.getFeatureColors(nextProps.activeFeatures, nextProps.loomFile);
        }
    }

    componentDidMount() {
        this.initGraphics();
    }


/*
    shouldComponentUpdate = (nextProps, nextState) => {
        // Update the rendering only if feature is different
        if (this.props.activeFeatures !== nextProps.activeFeatures)
            this.queryFeature(nextProps.activeFeatures)
        return true
    }
*/

    initGraphics() {
        const v = d3.select('#viewer')
        this.w = v.node().getBoundingClientRect().width;
        this.renderer = PIXI.autoDetectRenderer(this.w, this.h, { backgroundColor: 0xFFFFFF, antialias: true, view: v.node() });
        this.stage = new PIXI.Container();
        this.stage.width = this.w
        this.stage.height = this.h
        // Increase the maxSize if displaying more than 1500 (default) objects
        this.container = new PIXI.particles.ParticleContainer(this.maxn, [false, true, false, false, true]);
        this.stage.addChild(this.container);
        this.addLassoLayer()
        // Setup PIXI Canvas in componentDidMount
        //this.viewer.appendChild(this.renderer.view);
        v.call(d3.zoom().scaleExtent([1, 8]).on("zoom", this.zoom.bind(this)));
    }


    handleItemClick(e, tool) {
        console.log("Active tool ", tool.name);
        this.setState({ activeTool: tool.name });
    } 

    makePointSprite(c) {
        let s = new PIXI.Sprite(this.texture);
        s.scale.x = 2.5;
        s.scale.y = 2.5;
        s.anchor = { x: .5, y: .5 };
        s.tint = "0x"+ c;
        // Decompressing the color not working as without compression
        // tint request a full 6 hexadecimal digits format
        // if(c.length == 1)
        //     s.tint = "0x"+ c.repeat(6)
        // else if(c.length == 2)
        //     s.tint = "0x"+ c[0].repeat(3) + c[1].repeat(3)
        // else
        //     s.tint = "0x"+ c[0].repeat(2) + c[1].repeat(2) + c[2].repeat(2)
        return s;
    }

    getPointAtLocation(s, x, y) {
        const cx = x * 15 + this.renderer.width / 2;
        const cy = y * 15 + this.renderer.height / 2;
        s.position.x = cx;
        s.position.y = cy;
        return s;
    }

    getTexturedColorPoint(x, y, c) {
        return this.getPointAtLocation(this.makePointSprite(c), x, y)
    }

    updatePointColor(i, x, y, c) {
        let point = this.getTexturedColorPoint(x, y, c)
        this.container.removeChildAt(i);
        this.container.addChildAt(point, i);
    }

    highlightPointsInLasso() {
        this.startBenchmark("Lasso Highlight")
        let pts = this.container.children;
        let e = this.state.lassoSelections[this.state.lassoSelections.length-1];
        for (let i = 0; i < e.points.length; ++i)
            this.updatePointColor(e.points[i],pts[e.points[i]].position.x,pts[e.points[i]].position.y,e.color)
        this.endBenchmark();
        this.clearLasso();
        this.transformDataPoints();
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

    getPointsInLasso() {
        let pts = this.container.children, ptsInLasso = [], k = this.state.zoom.k
        if(pts.length < 2)
            return
        for (let i = 0; i < pts.length; ++i) {
            // Calculate the position of the point in the lasso reference
            let pointPosRelToLassoRef = this.lassoLayer.toLocal(pts[i], this.container)
            if(this.lasso.containsPoint(pointPosRelToLassoRef)) {
                ptsInLasso.push(i)
            }
        }
        console.log("Number of selected points: "+ ptsInLasso.length)
        return ptsInLasso
    }

    initLasso() {
        this.lasso = new PIXI.Graphics();
        this.lassoLayer.addChild(this.lasso);
    }

    drawLasso() {
        let lp = this.state.lassoPoints;
        if(lp.length < 2)
            return
        this.clearLasso();
        this.lasso.lineStyle(2, "#000")
        this.lasso.beginFill(0x8bc5ff, 0.4);
        this.lasso.moveTo(lp[0].x,lp[0].y)
        if(lp.length > 1) {
            this.lasso.drawPolygon(lp)
        }
        this.lasso.endFill();
        this.renderer.render(this.stage);
    }

    closeLasso() {
        this.setState({ lassoPoints: [ ...this.state.lassoPoints, this.state.lassoPoints[0] ] })
        this.drawLasso()
    }

    clearLasso() {
        this.lasso.clear()
    }

    addLassoLayer() {
        this.lassoLayer = new PIXI.Container();
        this.lassoLayer.width = this.w
        this.lassoLayer.height = this.h
        this.lassoLayer.hitArea = new PIXI.Rectangle(0, 0, this.w, this.h);
        this.lassoLayer.interactive = true;
        this.lassoLayer.buttonMode = true;
        this.lassoLayer.on("mousedown", (e) => {
            // Init lasso Graphics
            this.setState({ lassoPoints: [ ...this.state.lassoPoints, new PIXI.Point(e.data.global.x, e.data.global.y) ], mouse: { down: true } })
            if (typeof this.lasso !== "undefined") {
                this.setState({ lassoPoints: [], mouse: { down: true } })
                this.clearLasso()
            }
            this.initLasso()
        });
        this.lassoLayer.on("mouseup", (e) => {
            this.closeLasso()
            this.setState({ mouse: { down: false } })
            let lassoPoints = this.getPointsInLasso()
            if(lassoPoints.length > 1) {

                let lS = this.addLassoSelection(lassoPoints)

                this.highlightPointsInLasso()
                // Clear the lasso
                this.clearLasso()
            }
        });
        this.lassoLayer.on("mousemove", (e) => {
            // Bug in Firefox: this.state.mouse.down = false when left click pressed
            if(this.state.mouse.down & this.isLassoActive()) {
                this.setState({ lassoPoints: [ ...this.state.lassoPoints, new PIXI.Point(e.data.global.x, e.data.global.y) ] })
                this.drawLasso()
            }
        });
        this.stage.addChild(this.lassoLayer);
    }

    getRandomColor() {
        var letters = '0123456789ABCDEF';
        var color = '';
        for (var i = 0; i < 6; i++) {
          color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
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

    unSelectAllLassoSelections() {
        let lassoSelections = this.state.lassoSelections.map((lS) => {
            lS.selected = false
            return lS
        })
        this.setState({ lassoSelections: lassoSelections })
    }

    geometricZoom() {
        this.container.position.x = d3.event.transform.x;
        this.container.position.y = d3.event.transform.y;
        this.container.scale.x = d3.event.transform.k;
        this.container.scale.y = d3.event.transform.k;
    }

    semanticZoom() {
        let t = d3.event.transform
        this.container.position.x = t.x, this.container.position.y = t.y;
        if (this.state.zoom.k != t.k) {            
            this.setState({ zoom: { k: t.k } });
            this.transformDataPoints();
        }
        this.renderer.render(this.stage)
    }

    isLassoActive() {
        return this.state.activeTool === "lasso";
    }

    isGeometricZoomActive() {
        return this.state.activeTool === "g-zoom";
    }

    zoom() {
        if (this.state.mouse.down && this.isLassoActive()) {
            return
        }
        if (this.isGeometricZoomActive()) {
            this.geometricZoom()
        } else {
            this.semanticZoom()
        }
        //this.transformDataPoints();
    }

    getPoints(loomFile, callback) {
        console.log('loom:', loomFile);
        let query = {
            loomFilePath: loomFile
        };
        this.startBenchmark("Getting point coordinates")
        BackendAPI.getConnection().then((gbc) => {
            gbc.services.scope.Main.getCoordinates(query, (err, response) => {
                // Update the coordinates and remove all previous data points
                this.container.removeChildren();
                let c = {
                    x: response.x,
                    y: response.y
                }
                this.setState({ coord: c })
                this.endBenchmark()
                this.initializeDataPoints()
                callback()
            });
        });
    }

    initializeDataPoints() {
        this.startBenchmark("Initializing data points")
        let c = this.state.coord
        if (c.x.length !== c.y.length)
            throw "Coordinates does not have the same size."
        let dP = [], n = c.x.length;
        for (let i = 0; i < n; ++i) {
            let point = this.getTexturedColorPoint(c.x[i], c.y[i], "000000")
            this.container.addChild(point);
        }
        this.endBenchmark();
        console.log("The coordinates have been loaded! ")
        this.transformDataPoints();       
        //requestAnimationFrame(() => this.renderer.render(this.stage)); // Important to transfer the state
    }

    transformDataPoints() {
        this.startBenchmark("Transforming data points")
        let k = this.state.zoom.k, n = this.container.children.length, pts = this.container.children;
        let cx = this.renderer.width / 2;
        let cy = this.renderer.height / 2; // - 100
        for (let i = 0; i < n; ++i) {
            let x = this.state.coord.x[i] * 10 + cx;
            let y = this.state.coord.y[i] * 10 + cy;
            let p = pts[i];
            p.position.x = x * k
            p.position.y = y * k
        }
        this.endBenchmark();
        this.renderer.render(this.stage);
        
    }

    getFeatureColors(features, loomFile) {
        this.startBenchmark("Getting point feature colors")
        let settings = BackendAPI.getSettings();
        let query = {
            loomFilePath: loomFile,
            featureType: [features[0].type, features[1].type, features[2].type],
            feature: [features[0].value, features[1].value, features[2].value],
            hasLogTranform: settings.hasLogTransform,
            hasCpmTranform: settings.hasCpmNormalization
        };
        BackendAPI.getConnection().then((gbc) => {
            gbc.services.scope.Main.getCellColorByFeatures(query, (err, response) => {
                if(response !== null) {
                    this.endBenchmark()
                    this.updateDataPoints(response.color)
                } else {
                    this.endBenchmark()
                    this.resetDataPoints()
                }
            });
        });
    }

    updateDataPoints(v) {
        this.startBenchmark("Rendering point colors")
        let pts = this.container.children;
        let n = pts.length;
        // Draw new data points
        for (let i = 0; i < n; ++i) {
            let point = this.getTexturedColorPoint(pts[i].position.x, pts[i].position.y, v[i])
            this.container.addChildAt(point, n+i);
        }
        // Remove the first old data points (firstly rendered)
        this.container.removeChildren(0, n)
        this.endBenchmark();
        // Call for rendering
        this.transformDataPoints();
    }

    resetDataPoints() {
        this.startBenchmark("Resetting point colors")
        let pts = this.container.children;
        let n = pts.length;
        // Draw new data points
        for (let i = 0; i < n; ++i) {
            let point = this.getTexturedColorPoint(pts[i].position.x, pts[i].position.y, '000000')
            this.container.addChildAt(point, n+i);
        }
        // Remove the first old data points (firstly rendered)
        this.container.removeChildren(0, n)
        this.endBenchmark();
        // Call for rendering
        this.transformDataPoints();
    }

    startBenchmark(msg) {
        this.setState({ benchmark: { t1: performance.now(), msg: msg } })
    }

    endBenchmark() {
        var t2 = performance.now();
        let et = (t2 - this.state.benchmark.t1).toFixed(3)
        console.log("Benchmark - "+ this.state.benchmark.msg +": took " + et + " milliseconds.")
    }
}
