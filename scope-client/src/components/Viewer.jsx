import React, { Component } from 'react'
// https://github.com/pixijs/pixi.js/issues/3204
import * as PIXI from 'pixi.js'
import * as d3 from 'd3';
//
import { Segment, Header } from 'semantic-ui-react'


// Pixi.js Geometric Zooming: https://bl.ocks.org/pkerpedjiev/cf791db09ebcabaec0669362f4df1776
// Pixi mouseover example: https://ugotsta.github.io/2015/06/21/Pixi-mouseover-example.html

export default class Viewer extends Component {

    constructor(props) {
        super(props)
        this.state = {
            coord: {
                x: [],
                y: []
            },
            values: [],
            zoom: {
                type: 's',
                k : 1,
                transform : null
            },
            dataPoints: []
        }
        this.w = parseInt(this.props.width);
        this.h = parseInt(this.props.height);
        this.init()
        // Bind our animate and zoom functions
        this.update = this.update.bind(this);
        this.zoom = this.zoom.bind(this);
    }

    componentWillReceiveProps = (nextProps) => {
        if (this.props.loom !== nextProps.loom) {
            let query = {
                lfp: "my-looms/" + nextProps.loom
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
        if (this.props.feature === nextProps.feature)
            return false
        this.updateFeature(nextProps.feature)
        return true
    }

    componentDidMount() {
        // Setup PIXI Canvas in componentDidMount
        this.viewer.appendChild(this.renderer.view);
        d3.select('#viewer').call(d3.zoom().scaleExtent([1, 8]).on("zoom", this.zoom))
    }

    render() {
        return (
            <Segment basic>
                <Header as='h3'>Viewer</Header>
                <div ref={(el) => this.viewer = el} id="viewer"></div>
            </Segment>
        );
    }

    init = () => {
        const v = d3.select('#viewer')
        this.renderer = PIXI.autoDetectRenderer(this.w, this.h, { backgroundColor: 0xFFFFFF, antialias: true, view: v.node() });
        this.stage = new PIXI.Container();
        this.stage.width = this.w
        this.stage.height = this.h
        // Increase the maxSize if displaying more than 1500 (default) objects 
        this.container = new PIXI.particles.ParticleContainer(200000, [false, true, false, false, true]);
        this.stage.addChild(this.container);
    }

    geometricZoom() {
        // https://bl.ocks.org/mwdchang/a88aa3f61f5a2243d15bb8a264aa432e
        this.container.position.x = d3.event.transform.x;
        this.container.position.y = d3.event.transform.y;
        this.container.scale.x = d3.event.transform.k;
        this.container.scale.y = d3.event.transform.k;
    }

    transformDataPoints(t) {
        let dP = []
        let c = this.state.coord
        let n = this.container.children.length
        for (let i = 0; i < n; ++i) {
            let cx = (c.x[i] * 15 + this.renderer.width / 2) * t.k;
            let cy = (c.y[i] * 15 + this.renderer.height / 2) * t.k;
            let p = this.state.dataPoints[i]
            dP[i] = p.setTransform(cx, cy)
        }
        this.update()
        this.setState({ dataPoints: dP })
    }

    semanticZoom() {
        let t = d3.event.transform
        this.container.position.x = t.x, this.container.position.y = t.y;
        if(t.k !== this.state.zoom.k)
            this.transformDataPoints(t);
    }

    isGeometricZoom() {
        return this.state.zoom.type === "g";
    }

    zoom() {
        if(this.isGeometricZoom()) {
            this.geometricZoom()
        } else {
            this.semanticZoom()
        }
    }

    // const context = d3.select('#viewer').node().firstChild.getContext('webgl');

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

    update() {
        this.renderer.render(this.stage);
        requestAnimationFrame(this.update);
    }

    initializedDataPoints = () => {
        let c = this.state.coord
        if (c.x.length !== c.y.length)
            throw "Coordinates does not have the same size."
        let dP = []
        for (let i = 0; i < c.x.length; ++i) {
            let point = this.makePoint(c.x[i], c.y[i], "000000")
            dP.push(point)
            this.container.addChild(point);
        }
        this.setState({ dataPoints: dP })
        console.log("The coordinates have been loaded!")
        this.update()
    }

    updateFeature = (f) => {
        let query = {
            lfp: "my-looms/" + this.props.loom
            , f: ["gene", "", ""]
            , e: [f, "", ""]
            , lte: true
        };
        this.props.gbwccxn.then((gbc) => {
            gbc.services.scope.Main.getCellColorByFeatures(query, (err, response) => {
                if(response !== null) {
                    this.setState({ values: response.v })
                    this.updateDataPoints(this.state.zoom.transform)
                }
            });
        });
    }

    updateDataPoints = (t) => {
        var k = t === null ? 1 : t.k;
        var t1 = performance.now();
        console.log("Rendering...")
        let n = this.container.children.length, c = this.state.coord, v = this.state.values;
        // Draw new data points
        let dP = []
        for (let i = 0; i < n; ++i) {
            let point = this.makePoint(c.x[i], c.y[i], v[i])
            dP.push(point)
            this.container.addChildAt(point, n+i);
        }
        // Remove the first old data points (firstly rendered)
        this.container.removeChildren(0, n)
        this.update()
        var t2 = performance.now();
        let et = (t2 - t1).toPrecision(3)
        console.log("Rendering took " + et + " milliseconds.")
        // Update the state
        this.setState({ dataPoints: dP, zoom: { k: k, transform: t } })
    }

}