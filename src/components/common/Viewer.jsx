import React, { Component } from 'react'
import * as PIXI from 'pixi.js'
import * as d3 from 'd3';
import { BackendAPI } from './API'
import { Dimmer, Loader } from 'semantic-ui-react'
import ReactResizeDetector from 'react-resize-detector';
import ReactGA from 'react-ga';
import zlib from 'zlib';
import Popup from 'react-popup'

const DEFAULT_POINT_COLOR = 'A6A6A6';
const VIEWER_MARGIN = 5;

export default class Viewer extends Component {

	constructor(props) {
		super(props)
		this.state = {
			activeFeatures: BackendAPI.getActiveFeatures(),
			coord : {
				x: [],
				y: []
			},
			colors: props.colors || [],
			lassoPoints: [],
			lassoSelections: BackendAPI.getViewerSelections(),
			mouse: {
				down: false
			},
			loading: true,
			activeTool: BackendAPI.getViewerTool(),
			customScale: BackendAPI.getCustomScale(),
			activePage: BackendAPI.getActivePage(),
			benchmark: {}
		}
		this.zoomTransform = {
			x: 0,
			y: 0,
			k: 1
		};
		this.bcr = null
		this.w = parseInt(this.props.width);
		this.h = parseInt(this.props.height);
		// Increase the maxSize if displaying more than 1500 (default) objects
		this.maxn = 200000;
		this.texture = PIXI.Texture.fromImage("src/images/dot.png");
		this.settingsListener = (settings, customScale) => {
			if (this.props.settings) {
				this.setState({loading: true});
				this.getFeatureColors(this.state.activeFeatures, this.props.loomFile, this.props.thresholds, this.state.activeAnnotations, customScale, this.props.superposition);				
			}
		}
		this.spriteSettingsListener = () => {
			this.setState({loading: true});
			if (this.state.colors) this.updateDataPoints(this.state.colors);
			else this.resetDataPoints();
			this.repaintLassoSelections(this.state.lassoSelections);
		}
		this.viewerToolListener = (tool) => {
			this.setState({activeTool: tool});
		}
		this.viewerSelectionListener = (selections) => {
			this.onViewerSelectionChange(selections);
		}
		this.viewerTransformListener = (t) => {
			this.onViewerTransformChange(t);
		}
		this.customScaleListener = (scale) => {
			if (this.props.customScale) {
				this.onCustomScaleChange(scale);
			}
		}
		this.activeFeaturesListener = (features, featureID, customScale) => {
			this.onActiveFeaturesChange(features, featureID, customScale);
		}

	}

	render() {
		return (
			<div className="stretched">
				<canvas id={"viewer"+this.props.name}  >
				</canvas>
				<ReactResizeDetector skipOnMount handleWidth handleHeight onResize={this.onResize.bind(this)} />
				<Dimmer active={this.state.loading} inverted style={{zIndex: 0}}>
					<Loader inverted>Loading</Loader>
				</Dimmer>
			</div>
		);
	}

	componentWillMount() {
		BackendAPI.onSettingsChange(this.settingsListener);
		BackendAPI.onSpriteSettingsChange(this.spriteSettingsListener);
		BackendAPI.onViewerToolChange(this.viewerToolListener);
		BackendAPI.onViewerSelectionsChange(this.viewerSelectionListener);
		BackendAPI.onViewerTransformChange(this.viewerTransformListener);
		BackendAPI.onCustomScaleChange(this.customScaleListener);
		BackendAPI.onActiveFeaturesChange(this.state.activePage, this.activeFeaturesListener);
	}

	componentDidMount() {
		let viewerId = 'viewer'+this.props.name
		if (DEBUG) console.log(this.props.name, 'componentDidMount', this.props);
		this.zoomSelection = d3.select('#'+viewerId);
		let bbox = this.zoomSelection.select(function() {return this.parentNode}).node().getBoundingClientRect();
		this.w = bbox.width - VIEWER_MARGIN;
		this.h = bbox.height - VIEWER_MARGIN;

		this.initGraphics();
		if (this.props.loomFile != null) {
			this.getPoints(this.props.loomFile, this.props.activeCoordinates, this.props.activeAnnotations, this.props.superposition, () => {
				if (this.props.colors)	this.updateDataPoints(this.props.colors);
				else this.getFeatureColors(this.state.activeFeatures, this.props.loomFile, this.props.thresholds, this.props.activeAnnotations, this.state.customScale, this.props.superposition);
				this.onViewerSelectionChange(this.state.lassoSelections);
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
		if (DEBUG) console.log(this.props.name, 'componentWillReceiveProps', nextProps);

		// TODO: dirty hacks
		/*
		let bbox = this.zoomSelection.select(function() {return this.parentNode}).node().getBoundingClientRect();
		if ((parseInt(this.w) != parseInt(bbox.width - VIEWER_MARGIN)) || (parseInt(this.h) != parseInt(bbox.height - VIEWER_MARGIN))) {
			if (DEBUG) console.log(nextProps.name, 'changing size', bbox);
			this.w = bbox.width - VIEWER_MARGIN;
			this.h = bbox.height - VIEWER_MARGIN;
			this.resizeContainer();
		}
		*/
		this.onResize();

		if (this.props.loomFile != nextProps.loomFile || this.props.activeCoordinates != nextProps.activeCoordinates || this.props.superposition != nextProps.superposition ||
			(JSON.stringify(nextProps.activeAnnotations) != JSON.stringify(this.state.activeAnnotations)) ) {
				this.setState({loading: true});
				if (DEBUG) console.log(nextProps.name, 'changing points');
				this.getPoints(nextProps.loomFile, nextProps.activeCoordinates, nextProps.activeAnnotations, nextProps.superposition, () => {
					let featuresActive = false;
					this.state.activeFeatures.map((f) => {
						if (f.feature.length) featuresActive = true;
					})
					if (DEBUG) console.log(nextProps.name, 'features active', featuresActive);
					if (featuresActive) {
						this.getFeatureColors(this.state.activeFeatures, nextProps.loomFile, this.props.thresholds, this.state.activeAnnotations, this.state.customScale, nextProps.superposition);
					} else {
						this.setState({loading: false});
					}
				});
		}

		if (nextProps.customColors && (JSON.stringify(nextProps.colors) != JSON.stringify(this.state.colors))) {
			if (DEBUG) console.log(nextProps.name, 'changing colors');
			this.setState({colors: nextProps.colors});
			this.updateDataPoints(nextProps.colors);
		}
	}

	getJSONFeatures(features, field) {
		if (features) {
			return JSON.stringify(features.map((f) => {return f[field]}));
		} else {
			return null;
		}
	}

	componentWillUnmount() {
		BackendAPI.removeSettingsChange(this.settingsListener);
		BackendAPI.removeViewerToolChange(this.viewerToolListener);
		BackendAPI.removeViewerSelectionsChange(this.viewerSelectionListener);
		BackendAPI.removeViewerTransformChange(this.viewerTransformListener);
		BackendAPI.removeCustomScaleChange(this.customScaleListener);
		BackendAPI.removeActiveFeaturesChange(this.state.activePage, this.activeFeaturesListener);
		BackendAPI.removeSpriteSettingsChange(this.spriteSettingsListener);
		this.destroyGraphics();
	}
/*
	shouldComponentUpdate(nextProps, nextState) {
		return false;
	}
*/
	onResize(width, height) {
		let bbox = this.zoomSelection.select(function() {return this.parentNode}).node().getBoundingClientRect();
		console.log(this.props.name, 'onResize', width, height, bbox);
		let dw = bbox.width - this.w - VIEWER_MARGIN;
		let dh = bbox.height - this.h - VIEWER_MARGIN;
		if (((bbox.width != 0) && (2*VIEWER_MARGIN < dw || dw < -2*VIEWER_MARGIN)) || ((bbox.height != 0) && (2*VIEWER_MARGIN < dh || dh < -2*VIEWER_MARGIN))) {
			this.w = bbox.width - VIEWER_MARGIN;
			this.h = bbox.height - VIEWER_MARGIN;
			this.resizeContainer();
		}
	}

	resizeContainer() {
		if (DEBUG) console.log(this.props.name, 'resizeContainer', this.w, this.h);
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
//		this.stage.blendMode = PIXI.BLEND_MODES.ADD;
		this.stage.width = this.w;
		this.stage.height = this.h;
		this.renderer.render(this.stage);
		this.container = new PIXI.particles.ParticleContainer(this.maxn, [false, true, false, false, true]);
//		this.container.blendMode = PIXI.BLEND_MODES.NORMAL;
		this.container.interactive = true
		this.bcr = document.getElementById("viewer"+this.props.name).getBoundingClientRect()
		this.stage.addChild(this.container);
		this.addLassoLayer();
		this.zoomBehaviour = d3.zoom().scaleExtent([-1, 10]).on("zoom", this.zoom.bind(this));
		this.zoomSelection.call(this.zoomBehaviour);
		var ticker = PIXI.ticker.shared; 
		ticker.autoStart = false; 
		ticker.stop();
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
		let settings = BackendAPI.getSpriteSettings();
		s.scale.x = settings.scale / 50;
		s.scale.y = settings.scale / 50;
		s.alpha = settings.alpha;
		s.anchor = { x: .5, y: .5 };
		if (c == 'XXXXXX') c = DEFAULT_POINT_COLOR;
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
		s.blendMode = PIXI.BLEND_MODES.SCREEN;
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

	isLassoActive() {
		return this.state.activeTool === "lasso";
	}

	addLassoLayer() {
		this.lassoLayer = new PIXI.Container();
		this.lassoLayer.width = this.w;
		this.lassoLayer.height = this.h;
		this.selectionsLayer = new PIXI.Container();
//		this.selectionsLayer.blendMode = PIXI.BLEND_MODES.ADD;
		this.selectionsLayer.width = this.w;
		this.selectionsLayer.height = this.h;
		this.lassoLayer.hitArea = new PIXI.Rectangle(0, 0, this.w, this.h);
		this.lassoLayer.interactive = true;
		this.lassoLayer.buttonMode = true;
		this.lassoLayer.on("mousedown", (e) => {
			if (!this.isLassoActive()) return;
			this.zoomSelection.on('.zoom', null);
			this.setState({ lassoPoints: [ ...this.state.lassoPoints, new PIXI.Point(e.data.global.x, e.data.global.y) ], mouse: { down: true } })
			if (typeof this.lasso !== "undefined") {
				this.setState({ lassoPoints: [], mouse: { down: true } })
				this.clearLasso()
			}
			this.lasso = new PIXI.Graphics();
			this.lassoLayer.addChild(this.lasso);
		});
		this.lassoLayer.on("mouseup", (e) => {
			if (!this.isLassoActive()) return;
			this.zoomSelection.call(this.zoomBehaviour);
			this.closeLasso()
			this.setState({ mouse: { down: false } })
			const lassoPoints = this.getPointsInLasso();
			if(lassoPoints.length > 1) {
				this.clearLasso();
				this.addLassoSelection(lassoPoints);
			}
		});
		this.lassoLayer.on("mousemove", (e) => {
			// Bug in Firefox: this.state.mouse.down = false when left click pressed
			if(this.state.mouse.down & (this.isLassoActive())) {
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
			lassoPoints = [];
		if (pts.length < 2) return;
		for (let i = 0; i < pts.length; ++i) {
			// Calculate the position of the point in the lasso reference
			let pointPosRelToLassoRef = this.lassoLayer.toLocal(pts[i], this.container, null, true)
			if(this.lasso.containsPoint(pointPosRelToLassoRef)) {
				let idx = pts[i]._originalData.idx;
				lassoPoints.push(idx);
			}
		}
		if (DEBUG) console.log(this.props.name, 'getPointsInLasso', lassoPoints);
		return lassoPoints;
	}

	translatePointsInLasso(indices) {
		let ptsInLasso = [];
		let idxInLasso = _.intersection(indices, this.state.coord.idx);
		ptsInLasso = idxInLasso.map(idx => {
			return this.state.coord.idx.indexOf(idx);
		});
		if (DEBUG) console.log(this.props.name, 'translatePointsInLasso', indices, '>', ptsInLasso);
		return ptsInLasso;
	}

	addLassoSelection(lassoPoints, lassoIndices) {
		let lassoSelection = {
			id: this.state.lassoSelections.length,
			selected: true,
			color: this.getRandomColor(),
			points: lassoPoints,
			src: this.props.name,
			loomFilePath: this.props.loomFile,
			translations: {},
		}
		BackendAPI.addViewerSelection(lassoSelection);
		ReactGA.event({
			category: 'viewer',
			action: 'selection added',
			label: lassoPoints.length,
			value: this.state.lassoSelections.length
		});
	}

	repaintLassoSelections(selections) {
		this.selectionsLayer.removeChildren();
		selections.forEach((lS) => {
			if (lS.selected) this.highlightPointsInLasso(lS);
		})
		this.transformLassoPoints();
	}

	highlightPointsInLasso(lS) {
		this.startBenchmark("highlightPointsInLasso")
		let pts = this.container.children;
		pts.map(p => {
			if (lS.points.indexOf(p._originalData.idx) == -1) return;
			let point = this.getTexturedColorPoint(p._originalData.x, p._originalData.y, lS.color);
			this.selectionsLayer.addChild(point);
		})
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

	zoom() {
		let settings = BackendAPI.getSettings();
		let transform = () => {
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

		if(!settings.dissociateViewers) {
			transform()
		} else {
			if(this.containsPointer())
				transform()
		}

	}

	onActiveFeaturesChange(features, featureID, customScale) {
		if ((this.getJSONFeatures(features, 'feature') != this.getJSONFeatures(this.state.activeFeatures, 'feature')) ||
			(this.getJSONFeatures(features, 'featureType') != this.getJSONFeatures(this.state.activeFeatures, 'featureType')) ||
			(this.props.thresholds && (this.getJSONFeatures(features, 'threshold') != this.getJSONFeatures(this.state.activeFeatures, 'threshold')))) {


			this.setState({loading: true});
			
			let featuresActive = false;
			features.map((f) => {
				if (f.feature.length) featuresActive = true;
			})
			if (featuresActive)
				this.getFeatureColors(features, this.props.loomFile, this.props.thresholds, this.state.activeAnnotations, customScale, this.props.superposition);
			else {
				this.setState({activeFeatures: JSON.parse(JSON.stringify(features)), colors: []});
				this.resetDataPoints();
			}
		}
	}

	onCustomScaleChange(scale) {
		if (DEBUG) console.log(this.props.name, 'customScaleListener', scale, this.state.customScale);
		if (JSON.stringify(scale) != JSON.stringify(this.state.customScale)) {
			this.setState({loading: true, customScale: scale});
			this.getFeatureColors(this.state.activeFeatures, this.props.loomFile, this.props.thresholds, this.state.activeAnnotations, scale, this.props.superposition);
		}
	}

	onViewerSelectionChange(selections) {
		let currentSelections = [];
		if (DEBUG) console.log(this.props.name, 'onViewerSelectionChange', selections);
		if (this.props.translate) {
			selections.map((s, i) => {
				let ns = Object.assign({}, s);
				if (s.src != this.props.name) {
					if (s.translations[this.props.name]) {
						ns.points = s.translations[this.props.name];
					} else {
						if (s.loomFilePath != this.props.loomFile) {							
							ns.selected = false;
							let query = {
									srcLoomFilePath: s.loomFilePath,
									destLoomFilePath: this.props.loomFile,
									cellIndices: s.points,
								};
							if (DEBUG) console.log(this.props.name, 'translateLassoSelection', query);
							BackendAPI.getConnection().then((gbc) => {
								gbc.services.scope.Main.translateLassoSelection(query, (err, response) => {
									if (DEBUG) console.log(this.props.name, 'translateLassoSelection', response);
									ns.points = response.cellIndices;
									s.translations[this.props.name] = ns.points.slice(0);
									ns.selected = true;
									this.repaintLassoSelections(currentSelections);
								})
							}, () => {
								BackendAPI.showError();	
							})
						} else {
							s.translations[this.props.name] = ns.points.slice(0);
						}
					}
				}
				currentSelections.push(ns);
			})
		} else {
			currentSelections = selections;
		}
		this.setState({lassoSelections: currentSelections});
		this.repaintLassoSelections(currentSelections);
	}

	onViewerTransformChange(t) {
		// only for all zoom events of other components
		let settings = BackendAPI.getSettings();
		let transform = () => {
			let k = this.zoomTransform.t,
				x = this.zoomTransform.x + t.dx * (this.renderer.width / 2),
				y = this.zoomTransform.y + t.dy * (this.renderer.height / 2),
				transform = d3.zoomIdentity.translate(x, y).scale(t.k);
			transform.receivedFromListener = true;
			this.zoomBehaviour.transform(this.zoomSelection, transform);
		}
		if(!settings.dissociateViewers) {
			if((t.src != this.props.name) && (t.src != 'init'))
				transform()
		} else {
			if((t.src != this.props.name) && (t.src != 'init') && this.containsPointer())
				transform()
		}
	}

	getPoints(loomFile, coordinates, annotations, superposition, callback) {
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
			annotation: queryAnnotations,
			logic: superposition,
		};
		this.startBenchmark("getCoordinates")
		if (DEBUG) console.log(this.props.name, 'getCoordinates', query);
		BackendAPI.getConnection().then((gbc) => {
			gbc.services.scope.Main.getCoordinates(query, (err, response) => {
				// Update the coordinates and remove all previous data points
				if (DEBUG) console.log(this.props.name, 'getCoordinates', response);
				this.container.removeChildren();
				if (response) {
					let coord = {
						idx: response.cellIndices,
						x: response.x,
						y: response.y
					}
					this.setState({ coord });
					this.setScalingFactor();
				} else {
					console.log('Could not get the coordinates - empty response!')
					this.setState({ coord:  { idx: [], x: [], y: [] } });
				}
				this.endBenchmark("getCoordinates");
				this.initializeDataPoints(callback ? true : false);
				callback();
			});
		}, () => {
			BackendAPI.showError();	
		});
	}

	setScalingFactor() {
		if (!this.renderer) return;
		let min = this.renderer.width / (d3.max(this.state.coord.x) - d3.min(this.state.coord.x));
		let max = this.renderer.height / (d3.max(this.state.coord.y) - d3.min(this.state.coord.y));
		this.scalingFactor = Math.floor(d3.min([min, max])) - 1;
	}

	initializeDataPoints(stillLoading) {
		this.startBenchmark("initializeDataPoints");
		let c = this.state.coord;
		if (c.x.length !== c.y.length)
			throw "Coordinates does not have the same size.";
		let dP = [], n = c.x.length;
		for (let i = 0; i < n; ++i) {
			let point = this.getTexturedColorPoint(c.x[i], c.y[i], "000000");
			point._originalData.idx = c.idx[i];
			this.container.addChild(point);
		}
		this.endBenchmark("initializeDataPoints");
		this.transformDataPoints(stillLoading);
	}

	transformDataPoints(stillLoading) {
		if (DEBUG) console.log(this.props.name, 'transformDataPoints', stillLoading);
		this.transformPoints(this.container);
		this.transformPoints(this.selectionsLayer);
		requestAnimationFrame(() => {
			this.renderer.render(this.stage);
		});
		if (!stillLoading) this.setState({loading: false});
	}

	transformLassoPoints() {
		this.transformPoints(this.selectionsLayer);
		requestAnimationFrame(() => {
			this.renderer.render(this.stage);
		});
	}

	transformPoints(container) {
		let settings = BackendAPI.getSettings();
		// if(DEBUG) console.log("Points transformed in viewer"+ this.props.name)
		this.startBenchmark("transformPoints");
		let k = this.zoomTransform.k;
		let cx = this.renderer.width / 2;
		let cy = this.renderer.height / 2;
		for (let i = 0, n = container.children.length; i < n; ++i) {
			let p = container.children[i];
			let x = p._originalData.x * this.scalingFactor + cx;
			let y = p._originalData.y * this.scalingFactor + cy;
			p.position.x = x * k;
			p.position.y = y * k;
		}
		this.endBenchmark("transformPoints");
	}

	chunkString(str, length) {
		return str.match(new RegExp('.{1,' + length + '}', 'g'));
	}

	updateColors = (response, colors) => {
		if(response !== null) {
			this.setState({colors: colors});
			this.updateDataPoints();
		} else {
			this.resetDataPoints();
		}
	}

	getFeatureColors(features, loomFile, thresholds, annotations, scale, superposition) {
		if (scale) {
			this.setState({activeFeatures: JSON.parse(JSON.stringify(features)), customScale: scale.slice(0)});
		} else {
			this.setState({activeFeatures: JSON.parse(JSON.stringify(features))});
		}

		if (!features || (features.length == 0)) {
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
			featureType: features.map((f) => {return this.props.genes ? 'gene' : f.featureType}),
			feature: features.map((f) => {return this.props.genes ? f.feature.split('_')[0] : f.feature}),
			hasLogTransform: settings.hasLogTransform,
			hasCpmTransform: settings.hasCpmNormalization,
			threshold: thresholds ? features.map((f) => {return f.threshold}) : [0, 0, 0],
			scaleThresholded: this.props.scale,
			annotation: queryAnnotations,
			vmax: [0, 0, 0],
			logic: superposition
		};
		if (this.props.customScale && scale)  {
			query['vmax'] = scale;
		}
		if (DEBUG) console.log(this.props.name, 'getFeatureColors', query, scale);
		BackendAPI.getConnection().then((gbc) => {
			gbc.services.scope.Main.getCellColorByFeatures(query, (err, response) => {
				if(response.error !== null) {
					Popup.alert(response.error.message, response.error.type);
				} else {
					if (DEBUG) console.log(this.props.name, 'getFeatureColors', response);
					// Convert object to ArrayBuffer
					let responseBuffered = new Buffer(response.compressedColor.toArrayBuffer())
					// Uncompress
					if(response.hasAddCompressionLayer) {
						zlib.inflate(responseBuffered, (err, uncompressedMessage) => {
							if(err) console.log(err)
							else {
								this.endBenchmark("getFeatureColors")
								this.updateColors(response, this.chunkString(uncompressedMessage.toString(), 6))
							}
						});
					} else {
						this.endBenchmark("getFeatureColors")
						this.updateColors(response, response.color)
					}

					if(this.props.onActiveLegendChange != null) {
						this.props.onActiveLegendChange(response.legend)
					}
				}
			});
		}, () => {
			BackendAPI.showError();	
		});
	}
	
	hexToRgb(hex) {
		var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}
	
	updateDataPoints(colors) {
		this.startBenchmark("updateDataPoints")
		let n = this.container.children.length;
		this.container.removeChildren(0, n).map((p) => {
			p.destroy();
		})
		let settings = BackendAPI.getSettings();
		if (settings.sortCells) {
			let pts = _.zip(this.state.coord.idx, this.state.coord.x, this.state.coord.y, colors ? colors : this.state.colors);
			this.startBenchmark("sort")
			pts.sort((a, b) =>{
				let ca = this.hexToRgb(a[3]);
				let cb = this.hexToRgb(b[3]);
				let r = (ca ? (ca.r + ca.g + ca.b) : 0) - (cb ? (cb.r + cb.g + cb.b) : 0);
				return r;
			})
			this.endBenchmark("sort")
			this.startBenchmark("map")
			pts.map((p, i) => {
				let point = this.getTexturedColorPoint(p[1], p[2], p[3])
				point._originalData.idx = p[0];
				this.container.addChildAt(point, i);
			})
			this.endBenchmark("map")
		} else {
			this.startBenchmark("map")
			this.state.coord.idx.map((ci, i) => {
				let point = this.getTexturedColorPoint(this.state.coord.x[i], this.state.coord.y[i], this.state.colors[i])
				point._originalData.idx = ci;
				this.container.addChildAt(point, i);
			})
			this.endBenchmark("map")
		}
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
			point._originalData.idx = pts[i]._originalData.idx; 
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
		let et = (t2 - benchmark.t1) || 0;
		if (DEBUG) console.log(this.props.name + ": benchmark - "+ benchmark.msg +": took " + et.toFixed(3) + " milliseconds.")
		ReactGA.timing({
			category: 'Backend',
			variable: benchmark.msg,
			value: et,
			label: this.props.name
		});
	}

	containsPointer() {
		let mX = d3.event.sourceEvent.clientX, mY = d3.event.sourceEvent.clientY
		return new Rect(this.bcr.x, this.bcr.y, this.bcr.width, this.bcr.height).contains(mX, mY)
	}
}

class Rect {

	constructor(x, y, w, h) {
		this.x = x;
		this.y = y;
		this.width = w;
		this.height = h;
	}

	contains = (x, y) => {
		return this.x <= x && x <= this.x + this.width &&
			   this.y <= y && y <= this.y + this.height;
	}
}