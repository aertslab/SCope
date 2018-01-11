import React, { Component } from 'react'
import * as PIXI from 'pixi.js'
import * as d3 from 'd3';
//
import { Segment, Header, Icon, Menu } from 'semantic-ui-react'

export default class Viewer extends Component {

    constructor(props) {
        super(props)
        this.state = {
            coord: {
                x: [],
                y: []
            },
            values: [],
            dataPoints: [],
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
            activeTool: 'lasso'
        }
        this.w = parseInt(this.props.width);
        this.h = parseInt(this.props.height);
        this.maxn = parseInt(this.props.maxp);
        this.init()
        // Bind our animate and zoom functions
        this.update = this.update.bind(this);
        this.zoom = this.zoom.bind(this);
    }

    componentWillReceiveProps = (nextProps) => {
        if (this.props.loom !== nextProps.loom) {
            let query = {
                lfp: nextProps.loom
            };
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
                    this.initializedDataPoints()
                });
            });
        }
    }

    shouldComponentUpdate = (nextProps, nextState) => {
        // Update the rendering only if feature is different 
        if (this.props.feature !== nextProps.feature)
            this.updateFeature(nextProps.feature)
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
                    <Menu.Item name='g-zoom' active={activeTool === 'g-zoom'} onClick={this.handleItemClick}>
                        <div title="Geometric Zoom" style={{ display: "block", width: 20, height: 20, backgroundImage: 'url("src/images/loupe.svg")', backgroundSize: "cover" }}></div>
                    </Menu.Item>
                </Menu>
                <div ref={(el) => this.viewer = el} id="viewer"></div>
            </div>
        );
    }

    update() {
        this.renderer.render(this.stage);
        requestAnimationFrame(this.update);
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
            if (typeof this.lasso != "undefined") {
                this.setState({ lassoPoints: [], mouse: { down: true } })
                this.clearLasso()
            }
            this.initLasso()

        });
        this.lassoLayer.on("mouseup", (e) => {
            this.closeLasso()
            this.setState({ mouse: { down: false } })
            // Clear the lasso
            this.addLassoSelection(this.getPointsInLasso())
        });
        this.lassoLayer.on("mousemove", (e) => {
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
        let k = this.state.zoom.k, n = this.container.children.length
        for (let i = 0; i < n; ++i) {
            let cx = this.state.coord.x[i] * 15 + this.renderer.width / 2;
            let cy = this.state.coord.y[i] * 15 + this.renderer.height / 2;
            let p = this.state.dataPoints[i]
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
            this.lasso.drawPolygon(this.state.lassoPoints)
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

    makePoint = (x, y, c) => {
        let sprite = new PIXI.Sprite.fromImage("src/images/particle@2x.png");
        const cx = x * 15 + this.renderer.width / 2;
        const cy = y * 15 + this.renderer.height / 2;
        sprite.position.x = cx;
        sprite.position.y = cy;
        sprite.scale.x = 2.5;
        sprite.scale.y = 2.5;
        sprite.color = "0x"+c
        sprite.anchor = { x: .5, y: .5 };
        sprite.tint = sprite.color;
        return sprite;
    }

    initializedDataPoints = () => {
        let c = this.state.coord
        if (c.x.length !== c.y.length)
            throw "Coordinates does not have the same size."
        let dP = [];
        for (let i = 0; i < c.x.length; ++i) {
            let point = this.makePoint(c.x[i], c.y[i], "000000")
            dP.push(point)
            this.container.addChild(point);
        }
        this.setState({ dataPoints: dP })
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
        let dP = []
        for (let i = 0; i < n; ++i) {
            let point = this.makePoint(pts[i].position.x, pts[i].position.y, v[i])
            dP.push(point)
            this.container.addChildAt(point, n+i);
        }
        // Remove the first old data points (firstly rendered)
        this.container.removeChildren(0, n)
        // Call for rendering
        this.update()
        var t2 = performance.now();
        let et = (t2 - t1).toPrecision(3)
        console.log("Rendering took " + et + " milliseconds.")
        // Update the state
        this.setState({ dataPoints: dP })
    }

    updateFeature = (f) => {
        let query = {
            lfp: this.props.loom
            , f: ["gene", "", ""]
            , e: [f, "", ""]
            , lte: true
        };
        this.props.gbwccxn.then((gbc) => {
            gbc.services.scope.Main.getCellColorByFeatures(query, (err, response) => {
                if(response !== null) {
                    this.setState({ values: response.v })
                    this.updateDataPoints()
                }
            });
        });
    }
}