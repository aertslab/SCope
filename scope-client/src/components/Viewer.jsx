import React, { Component } from 'react'
// https://github.com/pixijs/pixi.js/issues/3204
import * as PIXI from 'pixi.js'

// Pixi.js Geometric Zooming: https://bl.ocks.org/pkerpedjiev/cf791db09ebcabaec0669362f4df1776
// Pixi mouseover example: https://ugotsta.github.io/2015/06/21/Pixi-mouseover-example.html

export default class Viewer extends Component {

    constructor(props) {
        super(props)
    }

    render() {
        return (
            <div ref={(el) => this.viewerCanvas = el} id="gameCanvas"></div>
        );
    }
}