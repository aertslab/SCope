import React, { Component } from 'react'
import * as PIXI from 'pixi.js'
import * as d3 from 'd3';
import {  Menu, Grid,  Checkbox, Input, Icon  } from 'semantic-ui-react'
import { BackendAPI } from './API'

export default class Viewer extends Component {

    constructor(props) {
        super(props)
        this.state = {
            type: 'gene',
            thresholds: [0, 0, 0],
            coord : {
                x: [],
                y: []
            },
            colors: [],
            lassoPoints: [],
            lassoSelections: BackendAPI.getViewerSelections(),
            mouse: {
                down: false
            },
            zoom: {
                type: 's',
                k : 1,
                transform : null
            },
            activeTool: BackendAPI.getViewerTool(),
            benchmark: {}
        }
        this.w = parseInt(this.props.width);
        this.h = parseInt(this.props.height);
        this.maxn = 200000;
        this.texture = PIXI.Texture.fromImage("src/images/particle@2x.png");
        BackendAPI.onSettingsChange(() => {
            this.getFeatureColors(this.props.activeFeatures, this.props.loomFile);
        });
        BackendAPI.onViewerToolChange((tool) => {
            this.setState({activeTool: tool});
        });
        BackendAPI.onViewerSelectionsChange((selections) => {
            console.log('lassoSelections', selections);
            this.setState({lassoSelections: selections});
            this.repaintLassoSelections();
        });
    }

    render() {
        return (
            <canvas id={"viewer"+this.props.name} style={{width: 100+'%'}}></canvas>
        );
    }

    componentWillMount() {
        if (this.props.loomFile != null) {
            this.getPoints(this.props.loomFile, () => {
                this.getFeatureColors(this.props.activeFeatures, this.props.loomFile, this.props.thresholds);
            });
        }
        if (this.props.activeFeatures != null) {
            this.getFeatureColors(this.props.activeFeatures);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.loomFile != nextProps.loomFile) {
            this.getPoints(nextProps.loomFile, () => {
                this.getFeatureColors(nextProps.activeFeatures, nextProps.loomFile, nextProps.thresholds);
            });
        } else {
            this.getFeatureColors(nextProps.activeFeatures, nextProps.loomFile, nextProps.thresholds);
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
        const v = d3.select('#viewer'+this.props.name)
        this.w = v.node().getBoundingClientRect().width;
        this.renderer = PIXI.autoDetectRenderer(this.w, this.h, { backgroundColor: 0xFFFFFF, antialias: true, view: v.node() });
        this.stage = new PIXI.Container();
        this.stage.width = this.w
        this.stage.height = this.h
        this.renderer.render(this.stage);
        // Increase the maxSize if displaying more than 1500 (default) objects
        this.container = new PIXI.particles.ParticleContainer(this.maxn, [false, true, false, false, true]);
        this.stage.addChild(this.container);
        this.addLassoLayer()
        // Setup PIXI Canvas in componentDidMount
        //this.viewer.appendChild(this.renderer.view);
        v.call(d3.zoom().scaleExtent([-1, 10]).on("zoom", this.zoom.bind(this)));
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
        s.blendMode = PIXI.BLEND_MODES.OVERLAY;
        s._originalData = {x: x, y: y};
        return s;
    }

    getTexturedColorPoint(x, y, c) {
        return this.getPointAtLocation(this.makePointSprite(c), x, y);
    }

    updatePointColor(i, x, y, c) {
        let point = this.getTexturedColorPoint(x, y, c)
        this.container.removeChildAt(i);
        this.container.addChildAt(point, i);
    }


    addLassoLayer() {
        this.lassoLayer = new PIXI.Container();
        this.lassoLayer.width = this.w;
        this.lassoLayer.height = this.h;
        this.selectionsLayer = new PIXI.Container();
        this.selectionsLayer.width = this.w;
        this.selectionsLayer.height = this.h;
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
            this.lasso = new PIXI.Graphics();
            this.lassoLayer.addChild(this.lasso);
        });
        this.lassoLayer.on("mouseup", (e) => {
            this.closeLasso()
            this.setState({ mouse: { down: false } })
            let lassoPoints = this.getPointsInLasso()
            if(lassoPoints.length > 1) {
                this.addLassoSelection(lassoPoints);
                this.clearLasso();
            }
        });
        this.lassoLayer.on("mousemove", (e) => {
            // Bug in Firefox: this.state.mouse.down = false when left click pressed
            if(this.state.mouse.down & this.isLassoActive()) {
                this.setState({ lassoPoints: [ ...this.state.lassoPoints, new PIXI.Point(e.data.global.x, e.data.global.y) ] })
                this.drawLasso()
            }
        });
        this.stage.addChild(this.selectionsLayer);
        this.stage.addChild(this.lassoLayer);
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
        this.lasso.clear();
        this.renderer.render(this.stage);
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

    addLassoSelection(lassoPoints) {
        let lassoSelection = { 
            id: this.state.lassoSelections.length,
            selected: true,
            color: this.getRandomColor(),
            points: lassoPoints
        }
        BackendAPI.addViewerSelection(lassoSelection);
    }

    repaintLassoSelections() {
        this.selectionsLayer.removeChildren();
        this.state.lassoSelections.forEach((lS) => {
            if (lS.selected) this.highlightPointsInLasso(lS);
        })
        this.transformLassoPoints();
    }

    highlightPointsInLasso(lS) {
        this.startBenchmark("highlightPointsInLasso")
        let pts = this.container.children;
        for (let i = 0; i < lS.points.length; ++i) {
            let idx = lS.points[i];
            let x = this.state.coord.x[idx];
            let y = this.state.coord.y[idx];
            let point = this.getTexturedColorPoint(x, y, lS.color);
            this.selectionsLayer.addChild(point);
        }
        this.endBenchmark("highlightPointsInLasso");
    }

    getRandomColor() {
        var letters = '0123456789ABCDEF';
        var color = '';
        for (var i = 0; i < 6; i++) {
          color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
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
        this.selectionsLayer.position.x = t.x, this.selectionsLayer.position.y = t.y;
        if (this.state.zoom.k != t.k) {            
            this.setState({ zoom: { k: t.k } });
            this.transformDataPoints();
        }
        requestAnimationFrame(() => {this.renderer.render(this.stage)})
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
        this.startBenchmark("getPoints")
        BackendAPI.getConnection().then((gbc) => {
            gbc.services.scope.Main.getCoordinates(query, (err, response) => {
                // Update the coordinates and remove all previous data points
                this.container.removeChildren();
                let c = {
                    x: response.x,
                    y: response.y
                }
                this.setState({ coord: c })
                this.endBenchmark("getPoints")
                this.initializeDataPoints()
                callback()
            });
        });
    }

    initializeDataPoints() {
        this.startBenchmark("initializeDataPoints")
        let c = this.state.coord
        if (c.x.length !== c.y.length)
            throw "Coordinates does not have the same size."
        let dP = [], n = c.x.length;
        for (let i = 0; i < n; ++i) {
            let point = this.getTexturedColorPoint(c.x[i], c.y[i], "000000")
            this.container.addChild(point);
        }
        this.endBenchmark("initializeDataPoints");
        this.transformDataPoints();
    }


    transformDataPoints() {
        this.transformPoints(this.container);
        this.transformPoints(this.selectionsLayer);
    }

    transformLassoPoints() {
        this.transformPoints(this.selectionsLayer);
    }

    transformPoints(container) {
        this.startBenchmark("transformPoints");
        let k = this.state.zoom.k;
        let cx = this.renderer.width / 2;
        let cy = this.renderer.height / 2; // - 100
        for (let i = 0, n = container.children.length; i < n; ++i) {
            let p = container.children[i];
            let x = p._originalData.x * 10 + cx;
            let y = p._originalData.y * 10 + cy;
            p.position.x = x * k
            p.position.y = y * k
        }
        this.renderer.render(this.stage);
        this.endBenchmark("transformPoints");
    }

    getFeatureColors(features, loomFile, thresholds) {
        if (thresholds == null) {
            thresholds = this.state.thresholds;
        }
        this.startBenchmark("getFeatureColors")
        let settings = BackendAPI.getSettings();
        let query = {
            loomFilePath: loomFile,
            featureType: [features[0].type, features[1].type, features[2].type],
            feature: [features[0].value, features[1].value, features[2].value],
            hasLogTranform: settings.hasLogTransform,
            hasCpmTranform: settings.hasCpmNormalization,
            threshold: thresholds[0],
            scaleThresholded: this.props.scale
        };
        console.log(query);
        BackendAPI.getConnection().then((gbc) => {
            gbc.services.scope.Main.getCellColorByFeatures(query, (err, response) => {
                this.endBenchmark("getFeatureColors")
                if(response !== null) {
                    this.setState({colors: response.color});
                    this.updateDataPoints(response.color);
                } else {
                    this.resetDataPoints()
                }
            });
        });
    }

    updateDataPoints(v) {
        this.startBenchmark("updateDataPoints")
        let pts = this.container.children;
        let n = pts.length;
        for (let i = 0; i < n; ++i) {
            let point = this.getTexturedColorPoint(pts[i]._originalData.x, pts[i]._originalData.y, v[i])
            this.container.addChildAt(point, n+i);
        }
        this.container.removeChildren(0, n)
        this.endBenchmark("updateDataPoints");
        this.transformDataPoints();
    }

    resetDataPoints() {
        this.startBenchmark("resetDataPoints")
        let pts = this.container.children;
        let n = pts.length;
        // Draw new data points
        for (let i = 0; i < n; ++i) {
            let point = this.getTexturedColorPoint(pts[i]._originalData.x, pts[i]._originalData.y, '000000')
            this.container.addChildAt(point, n+i);
        }
        // Remove the first old data points (firstly rendered)
        this.container.removeChildren(0, n)
        this.endBenchmark("resetDataPoints");
        // Call for rendering
        this.transformDataPoints();
    }

    startBenchmark(msg) {
        //console.log("Starting benchmark - "+ msg)
        let benchmark = this.state.benchmark;
        benchmark[msg] = { t1: performance.now(), msg: msg };
        this.setState({ benchmark: benchmark })
    }

    endBenchmark(msg) {
        var t2 = performance.now();
        let benchmark = this.state.benchmark[msg];
        let et = (t2 - benchmark.t1).toFixed(3)
        console.log("Benchmark - "+ benchmark.msg +": took " + et + " milliseconds.")
    }
}
