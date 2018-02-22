class API {
	constructor() {
		this.GBC = require("grpc-bus-websocket-client");
		this.GBCConnection = new this.GBC("ws://localhost:8081/", 'src/proto/s.proto', { scope: { Main: 'localhost:50052' } }).connect();

		this.activeLoom = null;
		this.activeLoomChangeListeners = [];

		this.features = {
			'gene': {
				0: {type: 'gene', value: ''},
				1: {type: 'gene', value: ''},
				2: {type: 'gene', value: ''}
			},
			'regulon': {
				0: {type: 'regulon', value: ''},
				1: {type: 'regulon', value: ''},
				2: {type: 'regulon', value: ''}
			},
		};
		this.featureChangeListeners = [];

		this.settings = {
			hasLogTransform: true,
			hasCpmNormalization: true
		}
		this.settingsChangeListeners = [];

		this.viewerTool = 's-zoom';
		this.viewerToolChangeListeners = [];

		this.viewerSelections = [];
		this.viewerSelectionsChangeListeners = [];
	}

	getConnection() {
		return this.GBCConnection;
	}


	getActiveLoom() {
		return this.activeLoom;
	}

	setActiveLoom(loom) {
		this.activeLoom = loom;
		this.activeLoomChangeListeners.forEach((listener) => {
			listener(this.activeLoom);
		})
	}

	onActiveLoomChange(listener) {
		this.activeLoomChangeListeners.push(listener);
	}


	getActiveFeatures(type) {
		return this.features[type];
	}

	setActiveFeature(featureId, featureType, featureValue) {
		this.features[featureType][featureId] = { type: featureType, value: featureValue }
		this.featureChangeListeners.forEach((listener) => {
			listener(this.features[featureType]);
		})
	}

	onActiveFeaturesChange(listener) {
		this.featureChangeListeners.push(listener);
	}


	getSettings() {
		return this.settings;
	}

	setSetting(key, value) {
		this.settings[key] = value;
		this.settingsChangeListeners.forEach((listener) => {
			listener(this.settings);
		})
	}

	onSettingsChange(listener) {
		this.settingsChangeListeners.push(listener);
	}

	
	getViewerTool() {
		return this.viewerTool;
	}

	setViewerTool(tool) {
		this.viewerTool = tool;
		this.viewerToolChangeListeners.forEach((listener) => {
			listener(this.viewerTool);
		})
	}

	onViewerToolChange(listener) {
		this.viewerToolChangeListeners.push(listener);
	}

	
	getViewerSelections() {
		return this.viewerSelections;
	}

	addViewerSelection(selection) {
		this.viewerSelections.push(selection);
		this.viewerSelectionsChangeListeners.forEach((listener) => {
			listener(this.viewerSelections);
		});
	}

	toggleLassoSelection(index) {
		this.viewerSelections[index].selected = !this.viewerSelections[index].selected;
		this.viewerSelectionsChangeListeners.forEach((listener) => {
			listener(this.viewerSelections);
		});
	}

	removeViewerSelection(index) {
		this.viewerSelections.splice(index, 1);
		this.viewerSelectionsChangeListeners.forEach((listener) => {
			listener(this.viewerSelections);
		});
	}

	onViewerSelectionsChange(listener) {
		this.viewerSelectionsChangeListeners.push(listener);
	}

	clearViewerSelections() {
		this.viewerSelections = [];
	}

}

export let BackendAPI = new API();
