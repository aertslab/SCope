var PIXI = require('pixi.js');
var d3 = require('d3');

var width = document.body.clientWidth;
var height = document.body.clientHeight;

var container = new PIXI.Container();
var stage = new PIXI.Container();

requestAnimationFrame(update);

stage.addChild(container);

let renderer = PIXI.autoDetectRenderer(800, 600, {backgroundColor:0xFFFFFF});
document.body.appendChild(renderer.view);

var canvas = d3.select(renderer.view);
canvas.style("width", width).style("height",height);

var centerY = height * .5;
var centerX = width * .5;
var particleSize = 64;
var data = d3.range(0,20000);
var yScale = d3.scaleLinear().domain(d3.extent(data)).range([height*.2, height*.8]);
var padding = 2;
var distortion = 3;
var radius =200;
var texture = PIXI.Texture.fromImage('images/particle@2x.png');
var mouse;
// fisheye variables
var k0 = Math.exp(distortion);
k0 = k0 / (k0 - 1) * radius;
var k1 = distortion / radius;

var initialRadius = 2.5, initialAngle = Math.PI * (3 - Math.sqrt(5));
data = data.map(function(i) {

    return {
        r: 2,
        vx:Math.random()*2 -1,
        vy:Math.random()*2 -1,
        x: Math.random() * width,
        y: Math.random() * height
    }
});

var extent = d3.extent(data, function(d,i) {return i});
var colourScale = d3.scaleSequential(d3.interpolateRainbow).domain(extent);

var circles = d3.selectAll("custom.circle")
.data(data)
.enter()
.append("custom")
.attr("class", "circle")
.each(function(d,i) {
    d.sprite = new PIXI.Sprite(texture);
    d.color = rgbToHex(d3.color(colourScale(i)).rgb());
    d.anchor = {x:.5, y:.5};
    d.sprite.tint = d.color;
    container.addChild(d.sprite);
});

canvas.on("mousemove", function() {

    mouse = {x:d3.event.clientX, y:d3.event.clientY};

})

d3
.forceSimulation(data)
.velocityDecay(0)
.alphaDecay(0)

d3.timer(function() {

    circles
    .each(function(d,i) {
        fisheye(d);
        d.sprite.position.x = d.tx;
        d.sprite.position.y = d.ty;
        d.sprite.scale.x = d.tz;
        d.sprite.scale.y = d.tz;
        if(d.x > width) d.vx *=-1;
        if(d.y > height) d.vy *=-1;
        if(d.x <0) d.vx *=-1; 
        if(d.y <0) d.vy *=-1;
    });

    renderer.render(stage);
});


function fisheye(n){
    if(!mouse) return;
    var d = mouse;
    var dx = n.x - d.x ;
    var dy = n.y - d.y ;
    var dd = Math.sqrt(dx * dx + dy * dy);
    if (dd && dd <= radius) {
        var k = k0 * (1 - Math.exp(-dd * k1)) / dd * .75 + .25;
        n.tx = d.x + dx * k;
        n.ty = d.y + dy * k;
        n.tz = Math.min(k, 10);
    } else {
        n.tx =n.x;
        n.ty =n.y;
        n.tz = 1;
    }
}

function rgbToHex(c) {
    return "0x" + componentToHex(c.r) + componentToHex(c.g) + componentToHex(c.b);
    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
}

function update() {
	renderer.render(stage);
	requestAnimationFrame(update);
}