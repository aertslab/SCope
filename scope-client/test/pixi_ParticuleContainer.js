var PIXI = require('pixi.js');
var d3 = require("d3");

let renderer = PIXI.autoDetectRenderer(800, 600, {backgroundColor:0xFFFFFF});

document.body.appendChild(renderer.view);

let stage = new PIXI.Stage(0xFFFFFF);

requestAnimationFrame(update);

// Increase the maxSize if displaying more than 1500 (default) objects 
let container = new PIXI.ParticleContainer(maxSize = 100000);
stage.addChild(container);

// var data = d3.range(0,100);
// data = data.map(function(i) {
    
//         return {
//             r: 1,
//             vx:Math.random()*2 -1,
//             vy:Math.random()*2 -1,
//             x: Math.random() * 800,
//             y: Math.random() * 600
//         }
//     });

// var extent = d3.extent(data, function(d,i) {return i});
// console.log(extent)
n = 10;
var colourScale = d3.scaleSequential(d3.interpolateRainbow).domain([0,10]);

for (let i = 0; i < n; ++i) {
    let sprite = new PIXI.Sprite.fromImage("images/particle@2x.png");
    // sprite.anchor.x = 0.5;
    // sprite.anchor.y = 0.5;
    sprite.position.x = Math.random() * 800;
    sprite.position.y = Math.random() * 600;
    sprite.scale.x = 2.5;
    sprite.scale.y = 2.5;
    sprite.color = rgbToHex(d3.color(colourScale(i)).rgb(i));
    sprite.anchor = {x:.5, y:.5};
    sprite.tint = sprite.color;
    container.addChild(sprite);
}

function update() {
	renderer.render(stage);
	requestAnimationFrame(update);
}

function rgbToHex(c) {
    return "0x" + componentToHex(c.r) + componentToHex(c.g) + componentToHex(c.b);
    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
}