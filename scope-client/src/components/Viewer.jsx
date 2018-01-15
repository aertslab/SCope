import React, { Component } from 'react'
import * as PIXI from 'pixi.js'
import * as d3 from 'd3';
//
import { Segment, Header, Icon, Menu } from 'semantic-ui-react'

export default class Viewer extends Component {

    constructor(props) {
        super(props)
        this.state = { coord: { x: []
                              , y: [] 
                            }
                     , values: []
                     , lassoPoints: []
                     , lassoSelections: []
                     , mouse: { down: false }
                     , zoom: { type: 's'
                             , k : 1
                             , transform : null
                             }
                     , activeTool: 's-zoom'
                     , benchmark: { featureQuery: 0
                                  , coordQuery: 0 }
        }
        this.w = parseInt(this.props.width);
        this.h = parseInt(this.props.height);
        this.maxn = parseInt(this.props.maxp);
        // Cache
        this.cache = {}
        // Graphics
        this.graphics = { textures: { point: PIXI.Texture.fromImage("src/images/particle@2x.png") } }
        this.init()
        // Bind zoom function
        this.zoom = this.zoom.bind(this);
    }

    componentWillReceiveProps = (nextProps) => {
        if (this.props.loom !== nextProps.loom) {
            let query = {
                lfp: nextProps.loom
            };
            this.setState({ benchmark : { coordQuery: performance.now() } })
            this.props.gbwccxn.then((gbc) => {
                gbc.services.scope.Main.getCoordinates(query, (err, response) => {
                    // Empty the container if needed
                    if (this.isContainterEmpty())
                        this.emptyContainer()
                    // Update the coordinates and remove all previous data points
                    let c = {
                        x: response.x,
                        y: response.y
                    }
                    this.setState({ coord: c })
                    this.benchmark("Coordinates query", this.state.benchmark.coordQuery)
                    this.initializedDataPoints()
                });
            });
        }
    }

    shouldComponentUpdate = (nextProps, nextState) => {
        // Update the rendering only if feature is different 
        if (this.props.featureQuery !== nextProps.featureQuery /*& this.props.multiqueryon === "false"*/)
            this.queryFeature(nextProps.featureQuery)
        return true
    }

    componentDidMount() {
        // Setup PIXI Canvas in componentDidMount
        this.viewer.appendChild(this.renderer.view);
        d3.select('#viewer').call(d3.zoom().scaleExtent([1, 8]).on("zoom", this.zoom))
    }

    handleItemClick = (e, { name }) => this.setState({ activeTool: name })

    render() {

        const { activeTool } = this.state

        return (
            <div>
                <Menu style={{position: "absolute", top: 0, left: 0, marginTop: 10, marginLeft: 10}}>
                    <Menu.Item name='lasso' active={activeTool === 'lasso'} onClick={this.handleItemClick}>
                        <div title="Lasso Tool" style={{ display: "block", width: 20, height: 20, backgroundImage: 'url("src/images/lasso.svg")', backgroundSize: "cover" }}></div>
                    </Menu.Item>
                    <Menu.Item name='s-zoom' active={activeTool === 's-zoom'} onClick={this.handleItemClick}>
                        <div title="Semantic Zoom" style={{ display: "block", width: 20, height: 20, backgroundImage: 'url("src/images/expad-arrows.svg")', backgroundSize: "cover" }}></div>
                    </Menu.Item>
                    {/* <Menu.Item name='g-zoom' active={activeTool === 'g-zoom'} onClick={this.handleItemClick}>
                        <div title="Geometric Zoom" style={{ display: "block", width: 20, height: 20, backgroundImage: 'url("src/images/loupe.svg")', backgroundSize: "cover" }}></div>
                    </Menu.Item> */}
                </Menu>
                <div ref={(el) => this.viewer = el} id="viewer"></div>
            </div>
        );
    }

    init = () => {
        const v = d3.select('#viewer')
        this.renderer = PIXI.autoDetectRenderer(this.w, this.h, { backgroundColor: 0xFFFFFF, antialias: true, view: v.node() });
        this.stage = new PIXI.Container();
        this.stage.width = this.w
        this.stage.height = this.h
        // Increase the maxSize if displaying more than 1500 (default) objects 
        this.container = new PIXI.particles.ParticleContainer(this.maxn, [false, true, false, false, true]);
        this.stage.addChild(this.container);
        this.addLassoLayer()
    }

    addLassoLayer = () => {
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
            console.log(this.state.mouse.down)
            this.initLasso()
        });
        this.lassoLayer.on("mouseup", (e) => {
            this.closeLasso()
            this.setState({ mouse: { down: false } })
            // Clear the lasso
            this.addLassoSelection(this.getPointsInLasso())
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

    geometricZoom() {
        this.container.position.x = d3.event.transform.x;
        this.container.position.y = d3.event.transform.y;
        this.container.scale.x = d3.event.transform.k;
        this.container.scale.y = d3.event.transform.k;
    }

    transformDataPoints() {
        let k = this.state.zoom.k, n = this.container.children.length, pts = this.container.children; 
        for (let i = 0; i < n; ++i) {
            let cx = this.state.coord.x[i] * 15 + this.renderer.width / 2;
            let cy = this.state.coord.y[i] * 15 + this.renderer.height / 2;
            let p = pts[i]
            p.position.x = cx * k
            p.position.y = cy * k
        }
        this.renderer.render(this.stage);
        requestAnimationFrame(() => this.transformDataPoints()); // Important to transfer the state
    }

    semanticZoom() {
        let t = d3.event.transform
        this.container.position.x = t.x, this.container.position.y = t.y;
        this.setState({ zoom: { k: t.k } })
    }

    isGeometricZoomActive() {
        return this.state.activeTool === "g-zoom";
    }

    zoom() {
        if(this.state.mouse.down & this.isLassoActive())
            return
        if(this.isGeometricZoomActive()) {
            this.geometricZoom()
        } else {
            this.semanticZoom()
        }
    }

    addLassoSelection(lassoSelection) {
        this.setState({ lassoSelections: [...this.state.lassoSelections, lassoSelection] })
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

    isLassoActive() {
        return this.state.activeTool === "lasso";
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
    }

    closeLasso() {
        this.setState({ lassoPoints: [ ...this.state.lassoPoints, this.state.lassoPoints[0] ] })
        this.drawLasso()
    }

    clearLasso() {
        this.lasso.clear()
    }

    emptyContainer = () => { this.container.destroy(true) }

    isContainterEmpty = () => { return (this.container.children.length > 0) }

    setPointLocation(s, x, y) {
        const cx = x * 15 + this.renderer.width / 2;
        const cy = y * 15 + this.renderer.height / 2;
        s.position.x = cx;
        s.position.y = cy;
        return s
    }

    makePointTexture = (c) => {
        let s = new PIXI.Sprite(this.graphics.textures.point);
        s.scale.x = 2.5;
        s.scale.y = 2.5;
        s.anchor = { x: .5, y: .5 };
        s.tint = "0x"+ c
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

    getPointTexture(x, y, c) {
        return this.setPointLocation(this.makePointTexture(c),x,y)
    }

    initializedDataPoints = () => {
        let c = this.state.coord
        if (c.x.length !== c.y.length)
            throw "Coordinates does not have the same size."
        let dP = [];
        for (let i = 0; i < c.x.length; ++i) {
            let point = this.getPointTexture(c.x[i], c.y[i], "000000")
            this.container.addChild(point);
        }
        console.log("The coordinates have been loaded!")
        // Start listening for events
        this.transformDataPoints();
    }

    updateDataPoints = () => {
        var t1 = performance.now();
        console.log("Rendering...")
        let pts = this.container.children; 
        let n = pts.length, v = this.state.values;
        // Draw new data points
        for (let i = 0; i < n; ++i) {
            let point = this.getPointTexture(pts[i].position.x, pts[i].position.y, v[i])
            this.container.addChildAt(point, n+i);
        }
        // Remove the first old data points (firstly rendered)
        this.container.removeChildren(0, n)
        // Call for rendering
        var t2 = performance.now();
        let et = (t2 - t1).toPrecision(3)
        console.log("Rendering took " + et + " milliseconds.")
    }

    queryFeature = (featureQuery) => {
        console.log(featureQuery)
        let query = {
            lfp: this.props.loom
            , f: [featureQuery.i0.type, featureQuery.i1.type, featureQuery.i2.type]
            , e: [featureQuery.i0.value, featureQuery.i1.value, featureQuery.i2.value]
            , lte: true
        };
        console.log(query)
        this.setState({ benchmark : { geneQuery: performance.now() } })
        this.props.gbwccxn.then((gbc) => {
            gbc.services.scope.Main.getCellColorByFeatures(query, (err, response) => {
                if(response !== null) {
                    this.setState({ values: response.v })
                    this.benchmark("Feature query", this.state.benchmark.geneQuery)
                    this.updateDataPoints()
                }
            });
        });
    }

    benchmark(msg,stateObj) {
        var t2 = performance.now();
        let et = (t2 - stateObj).toPrecision(3)
        console.log(msg +" took " + et + " milliseconds.")
    }
}