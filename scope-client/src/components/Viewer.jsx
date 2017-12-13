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
        if(this.props.loom !== nextProps.loom) {
            let query = { 
                lfp: "/home/luna.kuleuven.be/u0113561/Desktop/FlyBrainProject/"+ nextProps.loom
            };
            this.props.gbwccxn.then((gbc) => {
                gbc.services.scope.Main.getCoordinates(query, (err, response) => {
                    // Empty the container if needed
                    if(this.isContainterEmpty())
                        this.emptyContainer()
                    // Populate the container with the data
                    this.initializedDataPoints(response)
                });
            });
        }
    }

    shouldComponentUpdate = (nextProps, nextState) => {
        // Update the rendering only if feature is different 
        if(this.props.feature === nextProps.feature)
            return false
        this.updateFeature(nextProps.feature)
        return true
    }

    render() {
        return (
            <Segment basic>
                <Header as='h3'>Viewer</Header>
                {/* {this.props.feature} */}
                {/* <Image src='/assets/images/wireframe/paragraph.png' /> */}
                <div ref={(el) => this.viewer = el} id="viewer"></div>
            </Segment>
        );
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

    update = () => {
        // if(c.x.length !== c.y.length)
        //     throw "The coordinates does not have the same size."
        // let dP = []
        // for (let i = 0; i < c.x.length; ++i) {
        //     let sprite = new PIXI.Sprite.fromImage("src/images/particle@2x.png");
        //     const cx = c.x[i] * 15 + this.renderer.width / 2;
        //     const cy = c.y[i] * 15 + this.renderer.height / 2;
        //     sprite.position.x = cx;
        //     sprite.position.y = cy;
        //     sprite.scale.x = 2.5;
        //     sprite.scale.y = 2.5;
        //     sprite.color = "0x000000"
        //     sprite.anchor = {x:.5, y:.5};
        //     sprite.tint = sprite.color;
        //     dP.push(sprite)
        //     this.container.addChild(sprite);
        // }
        // this.setState({ dataPoints: dP })
        // console.log("The coordinates have been loaded!")
        // this.update();
        this.renderer.render(this.stage);
        requestAnimationFrame(this.update);
    }

    componentDidMount() {
        //Setup PIXI Canvas in componentDidMount
        this.viewer.appendChild(this.renderer.view);
        d3.select('#viewer').call(d3.zoom().scaleExtent([1, 8]).on("zoom", this.zoom))
    }

    init = () => {
        const v = d3.select('#viewer')
        this.renderer = PIXI.autoDetectRenderer(this.w, this.h, {backgroundColor:0xFFFFFF, antialias: true, view: v.node() });
        this.stage = new PIXI.Container();
        this.stage.width = this.w
        this.stage.height = this.h
        // Increase the maxSize if displaying more than 1500 (default) objects 
        this.container = new PIXI.particles.ParticleContainer(100000);
        this.stage.addChild(this.container);
    }

    initializedDataPoints = (c) => {
        if(c.x.length !== c.y.length)
            throw "Coordinates does not have the same size."
        let dP = []
        for (let i = 0; i < c.x.length; ++i) {
            let sprite = new PIXI.Sprite.fromImage("src/images/particle@2x.png");
            const cx = c.x[i] * 15 + this.renderer.width / 2;
            const cy = c.y[i] * 15 + this.renderer.height / 2;
            sprite.position.x = cx;
            sprite.position.y = cy;
            sprite.scale.x = 2.5;
            sprite.scale.y = 2.5;
            sprite.color = "0x000000"
            sprite.anchor = {x:.5, y:.5};
            sprite.tint = sprite.color;
            dP.push(sprite)
            this.container.addChild(sprite);
        }
        this.setState({ dataPoints: dP })
        console.log("The coordinates have been loaded!")
        this.update();
    }

    updateFeature = (f) => {
        let query = { lfp: "/home/luna.kuleuven.be/u0113561/Desktop/FlyBrainProject/"+ this.props.loom
                    , f: ["gene","",""]
                    , e: [f,"",""]
                    , lte: true };
        this.props.gbwccxn.then((gbc) => {
            gbc.services.scope.Main.getCellColorByFeatures(query, (err, response) => {
                this.updateDataPoints(response.v)
            });
        });
    }

    updateDataPoints = (c) => {
        console.log("Rendering...")
        // var dP = this.state.dataPoints
        // for (let i = 0; i < dP.length; ++i) {
        //     dP[i].color = "0x"+c[i]
        //     dP[i].tint = dP[i].color;
        // }
        // this.setState({ dataPoints: dP })
    }

}