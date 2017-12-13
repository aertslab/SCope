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
                lfp: "/home/luna.kuleuven.be/u0113561/Desktop/FlyBrainProject/" + nextProps.loom
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
        //Setup PIXI Canvas in componentDidMount
        this.viewer.appendChild(this.renderer.view);
        d3.select('#viewer').call(d3.zoom().scaleExtent([1, 8]).on("zoom", this.zoom))
    }

    render() {
        return (
            <Segment basic>
                <Header as='h3'>Viewer</Header>
                {/* <Image src='/assets/images/wireframe/paragraph.png' /> */}
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

    zoom() {
        // https://bl.ocks.org/mwdchang/a88aa3f61f5a2243d15bb8a264aa432e
        this.container.position.x = d3.event.transform.x;
        this.container.position.y = d3.event.transform.y;
        this.container.scale.x = d3.event.transform.k;
        this.container.scale.y = d3.event.transform.k;
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

    update() {
        this.renderer.render(this.stage);
        requestAnimationFrame(this.update);
    }

    initializedDataPoints = () => {
        let c = this.state.coord
        if (c.x.length !== c.y.length)
            throw "Coordinates does not have the same size."
        for (let i = 0; i < c.x.length; ++i) {
            let point = this.makePoint(c.x[i], c.y[i], "000000")
            this.container.addChild(point);
        }
        console.log("The coordinates have been loaded!")
        this.update()
    }

    updateFeature = (f) => {
        let query = {
            lfp: "/home/luna.kuleuven.be/u0113561/Desktop/FlyBrainProject/" + this.props.loom
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

    updateDataPoints = () => {
        var t1 = performance.now();
        console.log("Rendering...")
        let n = this.container.children.length
        let c = this.state.coord
        let v = this.state.values;
        // Draw new data points
        for (let i = 0; i < v.length; ++i) {
            let point = this.makePoint(c.x[i], c.y[i], v[i])
            this.container.addChildAt(point, n+i);
        }
        // Remove the first old data points (firstly rendered)
        this.container.removeChildren(0, n)
        this.update()
        var t2 = performance.now();
        let et = (t2 - t1).toPrecision(3)
        console.log("Rendering took " + et + " milliseconds.")
    }

}