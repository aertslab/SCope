import React, { Component } from 'react'
import * as PIXI from 'pixi.js'
import * as d3 from 'd3';
import { BackendAPI } from './API'
import ReactResizeDetector from 'react-resize-detector';

export default class Viewer extends Component {

	constructor(props) {
		super(props)
		this.state = {
			activeThresholds: [],
			activeFeatures: {},
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
			activeTool: BackendAPI.getViewerTool(),
			benchmark: {}
		}
		this.zoomTransform = {
			x: 0,
			y: 0,
			k: 1
		};
		this.w = parseInt(this.props.width);
		this.h = parseInt(this.props.height);
		// Increase the maxSize if displaying more than 1500 (default) objects
		this.maxn = 200000;
		this.texture = PIXI.Texture.fromImage("src/images/particle@2x.png");
		this.settingsListener = () => {
			this.getFeatureColors(this.props.activeFeatures, this.props.loomFile);
		}
		this.viewerToolListener = (tool) => {
			this.setState({activeTool: tool});
		}
		this.viewerSelectionListener = (selections) => {
			this.setState({lassoSelections: selections});
			this.repaintLassoSelections();
		}
		this.viewerTransformListener = (t) => {
			this.onViewerTransformChange(t);
		}
	}

	render() {
		return (
			<div>
				<canvas id={"viewer"+this.props.name} style={{width: 100+'%', height: this.props.height-1+'px'}} ></canvas>
				<ReactResizeDetector handleWidth skipOnMount onResize={this.onResize.bind(this)} />
			</div>
		);
	}

	componentWillMount() {
		BackendAPI.onSettingsChange(this.settingsListener);
		BackendAPI.onViewerToolChange(this.viewerToolListener);
		BackendAPI.onViewerSelectionsChange(this.viewerSelectionListener);
		BackendAPI.onViewerTransformChange(this.viewerTransformListener);
	}

	componentDidMount() {
		this.zoomSelection = d3.select('#viewer'+this.props.name);
		this.w = this.zoomSelection.node().getBoundingClientRect().width;
		this.initGraphics();
		if (this.props.loomFile != null) {
			this.getPoints(this.props.loomFile, this.props.activeCoordinates, this.props.activeAnnotations, () => {
				this.getFeatureColors(this.props.activeFeatures, this.props.loomFile, this.props.thresholds, this.props.activeAnnotations);
				let t = BackendAPI.getViewerTransform();
				if (t) {
					let initialTransform = d3.zoomTransform(d3.select('#viewer' + t.src).node());
					initialTransform.src = 'init';
					initialTransform.receivedFromListener = true;
					this.zoomBehaviour.transform(this.zoomSelection, initialTransform);					
				}
			});
		}
	}

	componentWillReceiveProps(nextProps) {
		// TODO: dirty hack
		if (DEBUG) console.log(nextProps.name, 'componentWillReceiveProps', JSON.stringify(nextProps.activeAnnotations), JSON.stringify(this.state.activeAnnotations));
		
		if (this.h != nextProps.height) {
			console.log('resizing');
			this.h = nextProps.height;
			this.resizeContainer();
		}
		
		if (this.props.loomFile != nextProps.loomFile || this.props.activeCoordinates != nextProps.activeCoordinates || 
			(JSON.stringify(nextProps.activeAnnotations) != JSON.stringify(this.state.activeAnnotations)) ) {
				console.log('changing');
				this.getPoints(nextProps.loomFile, nextProps.activeCoordinates, nextProps.activeAnnotations, () => {
					this.getFeatureColors(nextProps.activeFeatures, nextProps.loomFile, nextProps.thresholds, nextProps.activeAnnotations);
				});
		} else if (
			(JSON.stringify(nextProps.activeFeatures) != JSON.stringify(this.state.activeFeatures)) ||
			(JSON.stringify(nextProps.thresholds) != JSON.stringify(this.state.activeThresholds))
			) {
				console.log('features');
				this.getFeatureColors(nextProps.activeFeatures, nextProps.loomFile, nextProps.thresholds);
		}
	}

	componentWillUnmount() {
		BackendAPI.removeSettingsChange(this.settingsListener);
		BackendAPI.removeViewerToolChange(this.viewerToolListener);
		BackendAPI.removeViewerSelectionsChange(this.viewerSelectionListener);
		BackendAPI.removeViewerTransformChange(this.viewerTransformListener);
		this.destroyGraphics();
	}
/*
	shouldComponentUpdate(nextProps, nextState) {
		return false;
	}
*/
	onResize() {
		let brect = this.zoomSelection.node().getBoundingClientRect();
		if ((brect.width != 0) && (brect.width != this.w)) {
			this.w = brect.width;
			this.resizeContainer();
		}
	}

	resizeContainer() {
		if (DEBUG) console.log(this.props.name, 'new dimensions', this.w, this.h);
		this.forceUpdate();
		this.renderer.resize(this.w, this.h);
		this.renderer.reset();
		this.container.removeChildren();
		this.setScalingFactor();
		this.initializeDataPoints();
		this.updateDataPoints();
	}


	initGraphics() {
		if (DEBUG) console.log("Initializing Viewer ", this.props.name);
		this.renderer = PIXI.autoDetectRenderer(this.w, this.h, { backgroundColor: 0xFFFFFF, antialias: true, view: this.zoomSelection.node() });
		this.stage = new PIXI.Container();
		this.stage.width = this.w;
		this.stage.height = this.h;
		this.renderer.render(this.stage);
		this.container = new PIXI.particles.ParticleContainer(this.maxn, [false, true, false, false, true]);
		this.stage.addChild(this.container);
		this.addLassoLayer();
		this.zoomBehaviour = d3.zoom().scaleExtent([-1, 10]).on("zoom", this.zoom.bind(this));
		this.zoomSelection.call(this.zoomBehaviour);
	}

	destroyGraphics() {
		if (DEBUG) console.log("Destroying Viewer ", this.props.name);
		this.container.removeChildren();
		this.container.destroy();
		this.lassoLayer.removeChildren();
		this.lassoLayer.destroy();
		this.selectionsLayer.removeChildren();
		this.selectionsLayer.destroy();
		this.renderer.destroy();
		this.stage.destroy();
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
		s.blendMode = PIXI.BLEND_MODES.ADD;
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
		requestAnimationFrame(() => {
			this.renderer.render(this.stage);
		});
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
		let pts = this.container.children,
			ptsInLasso = [],
			k = this.zoomTransform.k;
		if(pts.length < 2)
			return
		for (let i = 0; i < pts.length; ++i) {
			// Calculate the position of the point in the lasso reference
			let pointPosRelToLassoRef = this.lassoLayer.toLocal(pts[i], this.container)
			if(this.lasso.containsPoint(pointPosRelToLassoRef)) {
				ptsInLasso.push(i)
			}
		}
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

	isLassoActive() {
		return this.state.activeTool === "lasso";
	}

	zoom() {
		// TODO: bug with first move when lasso active
		if (this.state.mouse.down && this.isLassoActive()) {
			return
		}

		let t1 = d3.event.transform,
			t0 = this.zoomTransform,
			dx = (t1.x - t0.x) / (this.renderer.width / 2),
			dy = (t1.y - t0.y) / (this.renderer.height / 2);

		this.container.position.x = t1.x;
		this.container.position.y = t1.y;
		this.selectionsLayer.position.x = t1.x;
		this.selectionsLayer.position.y = t1.y;
		this.zoomTransform = {x: t1.x, y: t1.y, k: t1.k};

		if (t0.k != t1.k) {
			// on zoom
			// TODO: memory leak: increase in unnecessary listeners
			this.transformDataPoints();
		} else {
			// on move
			requestAnimationFrame(() => {
				this.renderer.render(this.stage);
			});
		}

		// notify other viewers only for genuine zoom transforms
		if (!t1.receivedFromListener) BackendAPI.setViewerTransform({k: t1.k, dx: dx, dy: dy, src: this.props.name});
	}

	onViewerTransformChange(t) {
		// only for all zoom events of other components
		if ((t.src != this.props.name)&&(t.src != 'init')) {
			let k = this.zoomTransform.t,
				x = this.zoomTransform.x + t.dx * (this.renderer.width / 2),
				y = this.zoomTransform.y + t.dy * (this.renderer.height / 2),
				transform = d3.zoomIdentity.translate(x, y).scale(t.k);
			transform.receivedFromListener = true;
			this.zoomBehaviour.transform(this.zoomSelection, transform);
		}
	}

	getPoints(loomFile, coordinates, annotations, callback) {
		let queryAnnotations = []
		if (annotations) {
			this.setState({activeAnnotations: Object.assign({}, annotations)});
			Object.keys(annotations).map((name) => {
				queryAnnotations.push({
					name: name,
					values: annotations[name]
				});
			});
		}
		
		let query = {
			loomFilePath: loomFile,
			coordinatesID: parseInt(coordinates),
			annotation: queryAnnotations
		};
		if (DEBUG) console.log('getPoints', query);
		this.startBenchmark("getPoints")
		BackendAPI.getConnection().then((gbc) => {
			gbc.services.scope.Main.getCoordinates(query, (err, response) => {
				// Update the coordinates and remove all previous data points
				if (DEBUG) console.log('getPoints', response);
				if (response) {
					this.container.removeChildren();
					let c = {
						x: response.x,
						y: response.y
					}
					this.setState({ coord: c });
					this.setScalingFactor();
				} else {
					console.log('Could not get the coordinates - empty response!')
				}
				this.endBenchmark("getPoints");
				this.initializeDataPoints();
				callback();
			});
		});
	}

	setScalingFactor() {
		let min = this.renderer.width / (d3.max(this.state.coord.x) - d3.min(this.state.coord.x));
		let max = this.renderer.height / (d3.max(this.state.coord.y) - d3.min(this.state.coord.y));
		this.scalingFactor = Math.floor(d3.min([min, max])) - 1;
	}

	initializeDataPoints() {
		this.startBenchmark("initializeDataPoints");
		let c = this.state.coord;
		if (c.x.length !== c.y.length)
			throw "Coordinates does not have the same size.";
		let dP = [], n = c.x.length;
		for (let i = 0; i < n; ++i) {
			let point = this.getTexturedColorPoint(c.x[i], c.y[i], "000000");
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
		let k = this.zoomTransform.k;
		let cx = this.renderer.width / 2;
		let cy = this.renderer.height / 2; // - 100
		for (let i = 0, n = container.children.length; i < n; ++i) {
			let p = container.children[i];
			let x = p._originalData.x * this.scalingFactor + cx;
			let y = p._originalData.y * this.scalingFactor + cy;
			p.position.x = x * k;
			p.position.y = y * k;
		}
		//requestAnimationFrame(() => {
			this.renderer.render(this.stage);
		//});
		this.endBenchmark("transformPoints");
	}

	getFeatureColors(features, loomFile, thresholds, annotations) {		
		if (thresholds == null) {
			thresholds = [0, 0, 0];
		}
		this.setState({activeFeatures: Object.assign({}, features), activeThresholds: thresholds.slice(0)});
		if (features[0].value.length + features[1].value.length + features[2].value.length == 0) {
			// prevent empty requests
			return this.resetDataPoints();
		}
		this.startBenchmark("getFeatureColors")
		let settings = BackendAPI.getSettings();

		let queryAnnotations = []
		if (annotations) {
			Object.keys(annotations).map((name) => {
				queryAnnotations.push({
					name: name,
					values: annotations[name]
				});
			});
		}
		let query = {
			loomFilePath: loomFile,
			featureType: [features[0].type, features[1].type, features[2].type],
			feature: [features[0].value, features[1].value, features[2].value],
			hasLogTranform: settings.hasLogTransform,
			hasCpmTranform: settings.hasCpmNormalization,
			threshold: thresholds,
			scaleThresholded: this.props.scale,
			annotation: queryAnnotations
			// vmax: float
		};
		if (DEBUG) console.log('getFeatureColors', query);
		BackendAPI.getConnection().then((gbc) => {
			gbc.services.scope.Main.getCellColorByFeatures(query, (err, response) => {
				if (DEBUG) console.log('getFeatureColors', response);
				this.endBenchmark("getFeatureColors")
				if(response !== null) {
					this.setState({colors: response.color});
					this.setState({vmax: response.vmax});
					this.updateDataPoints();
				} else {
					this.resetDataPoints();
				}
			});
		});
	}

	updateDataPoints() {
		this.startBenchmark("updateDataPoints")
		let pts = this.container.children;
		let n = pts.length;
		let v = this.state.colors;
		for (let i = 0; i < n; ++i) {
			let point = this.getTexturedColorPoint(pts[i]._originalData.x, pts[i]._originalData.y, v[i])
			this.container.addChildAt(point, n+i);
		}
		this.container.removeChildren(0, n).map((p) => {
			p.destroy();
		})
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
		let benchmark = this.state.benchmark;
		benchmark[msg] = { t1: performance.now(), msg: msg };
		this.setState({ benchmark: benchmark })
	}

	endBenchmark(msg) {
		var t2 = performance.now();
		let benchmark = this.state.benchmark[msg];
		let et = (t2 - benchmark.t1).toFixed(3)
		if (DEBUG) console.log(this.props.name + ": benchmark - "+ benchmark.msg +": took " + et + " milliseconds.")
	}
}
