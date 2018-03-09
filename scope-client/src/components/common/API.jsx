class API {
	constructor() {
		this.GBC = require("grpc-bus-websocket-client");
		this.GBCConnection = new this.GBC("ws://" + BACKEND.host + ":" + BACKEND.WSport + "/", 'src/proto/s.proto', { scope: { Main: BACKEND.host + ":" + BACKEND.RPCport } }).connect();

		this.loomFiles = [];
		this.activePage = 'welcome';
		this.activeLoom = null;
		this.activeCoordinates = -1;
		this.activeLoomChangeListeners = [];

		this.features = {};
		this.emptyFeature = {type: '', featureType: '', feature: '', threshold: 0};
		
		this.featureChangeListeners = {};

		this.settings = {
			hasLogTransform: true,
			hasCpmNormalization: false
		}
		this.settingsChangeListeners = [];

		this.viewerTool = 's-zoom';
		this.viewerToolChangeListeners = [];

		this.viewerSelections = [];
		this.viewerSelectionsChangeListeners = [];

		this.viewerTransform = null;
		this.viewerTransformChangeListeners = [];

		this.sidebarVisible = true;
		this.sidebarListeners = [];

		this.colors = ["red", "green", "blue"];

		this.maxValues = [];
		this.maxValuesPerViewer = {};
		this.maxValuesChangeListeners = [];
		this.customValues = [0, 0, 0];
		this.customValuesChangeListeners = [];
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
			listener(this.activeLoom, this.loomFiles[this.activeLoom], this.activeCoordinates);
		})
	}

	setActiveCoordinates(coords) {
		this.activeCoordinates = coords;
		this.activeLoomChangeListeners.forEach((listener) => {
			listener(this.activeLoom,  this.loomFiles[this.activeLoom], this.activeCoordinates);
		})
	}

	getActiveLoomMetadata() {
		return this.loomFiles[this.activeLoom];
	}

	onActiveLoomChange(listener) {
		this.activeLoomChangeListeners.push(listener);
	}

	removeActiveLoomChange(listener) {
		let i = this.activeLoomChangeListeners.indexOf(listener);
		if (i > -1) {
			this.activeLoomChangeListeners.splice(i, 1);
		}
	}

	getActiveCoordinates() {
		return this.activeCoordinates;
	}


	getLoomFiles() {
		return this.loomFiles;
	}

	setLoomFiles(files) {		
		this.loomFiles = {};
		Object.keys(files).map((i) => {
			let file = files[i];
			this.loomFiles[file.loomFilePath] = file;
		});
	}

	getActiveFeatures() {
		return this.features[this.activePage] ? this.features[this.activePage] : [];
	}

	setActiveFeature(id, type, featureType, feature, threshold, metadata) {
		let page = this.activePage;
		let selectedFeatures = this.features[page] || [this.emptyFeature, this.emptyFeature, this.emptyFeature];
		selectedFeatures[id] = {type: type, featureType: featureType ? featureType : '', feature: feature ? feature : '', threshold: threshold, metadata: metadata};
		this.features[page] = selectedFeatures;
		(this.featureChangeListeners[page] || []).forEach((listener) => {
			listener(selectedFeatures, id);
		})
	}

	onActiveFeaturesChange(page, listener) {
		if (!this.featureChangeListeners[page]) this.featureChangeListeners[page] = [];
		this.featureChangeListeners[page].push(listener);
	}

	removeActiveFeaturesChange(page, listener) {
		let i = this.featureChangeListeners[page].indexOf(listener);
		if (i > -1) {
			this.featureChangeListeners[page].splice(i, 1);
		}
	}

	
	getFeaturesScale() {
		return this.getMaxValues();
	}

	removeFeatureScales(viewer) {
		delete(this.maxValuesPerViewer[viewer]);
		console.log('removeFeatureScales', viewer, this.maxValues)
		this.maxValues = this.getMaxValues();
		this.maxValuesChangeListeners.forEach((listener) => {
			listener(this.maxValues, null);
		})
	}

	setFeatureScales(values, id, viewer) {
		if (DEBUG) console.log('setFeatureScales', values, id, viewer);
		if (id == null || id == undefined) {
			this.maxValuesPerViewer[viewer] = values;
			this.maxValues = this.getMaxValues();
			this.customValues = this.maxValues.slice(0);
		} else {
			this.maxValuesPerViewer[viewer] = this.maxValuesPerViewer[viewer] || [0, 0, 0];
			this.maxValuesPerViewer[viewer][id] = values[id];
			this.maxValues = this.getMaxValues();
			this.customValues[id] = this.maxValues[id];
		}
		this.maxValuesChangeListeners.forEach((listener) => {
			listener(this.maxValues, id);
		})
	}

	getMaxValues() {
		let r = [], g = [], b = [];
		Object.keys(this.maxValuesPerViewer).map(viewer => {
			r.push(this.maxValuesPerViewer[viewer][0]);
			g.push(this.maxValuesPerViewer[viewer][1]);
			b.push(this.maxValuesPerViewer[viewer][2]);
		})
		let max = [Math.max(...r, 0), Math.max(...g, 0), Math.max(...b, 0)]
		if (DEBUG) console.log ('getMaxValues', max);
		return max;
	}

	onFeaturesScaleChange(listener) {
		this.maxValuesChangeListeners.push(listener);
	}

	removeFeaturesScaleChange(listener) {
		let i = this.maxValuesChangeListeners.indexOf(listener)
		if (i > -1) {
			this.maxValuesChangeListeners.splice(i, 1);
		}
	}


	getCustomScale() {
		return this.customValues;
	}

	setCustomScale(scale, featureID, vmaxID) {
		this.customValues = scale;
		this.customValuesChangeListeners.forEach((listener) => {
			listener(this.customValues, this.getMaxValues(), featureID, vmaxID);
		})
	}

	onCustomScaleChange(listener) {
		this.customValuesChangeListeners.push(listener);
	}

	removeCustomScaleChange(listener) {
		let i = this.customValuesChangeListeners.indexOf(listener)
		if (i > -1) {
			this.customValuesChangeListeners.splice(i, 1);
		}
	}


	
	getActivePage() {
		return this.activePage;		
	}

	setActivePage(page) {
		this.maxValues = [];
		this.maxValuesPerViewer = {};
		this.customValues = [0, 0, 0];
		this.activePage = page;
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
	
	removeSettingsChange(listener) {
		let i = this.settingsChangeListeners.indexOf(listener)
		if (i > -1) {
			this.settingsChangeListeners.splice(i, 1);
		}
	};
	
	

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

	removeViewerToolChange(listener) {
		let i = this.viewerToolChangeListeners.indexOf(listener)
		if (i > -1) {
			this.viewerToolChangeListeners.splice(i, 1);
		}
	};
	

	
	getViewerSelections() {
		return this.viewerSelections;
	}

	addViewerSelection(selection) {
		if (DEBUG) console.log('addViewerSelection', selection)
		this.viewerSelections.push(selection);
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

	removeViewerSelectionsChange(listener) {
		let i = this.viewerSelectionsChangeListeners.indexOf(listener)
		if (i > -1) {
			this.viewerSelectionsChangeListeners.splice(i, 1);
		}
	};

	clearViewerSelections() {
		this.viewerSelections = [];
	}



	toggleLassoSelection(index) {
		this.viewerSelections[index].selected = !this.viewerSelections[index].selected;
		this.viewerSelectionsChangeListeners.forEach((listener) => {
			listener(this.viewerSelections);
		});
	}


	
	setViewerTransform(transform) {
		this.viewerTransform = transform;
		this.viewerTransformChangeListeners.forEach((listener) => {
			listener(this.viewerTransform);
		})
	}

	getViewerTransform() {
		return this.viewerTransform;
	}

	onViewerTransformChange(listener) {
		this.viewerTransformChangeListeners.push(listener);
	}

	removeViewerTransformChange(listener) {
		let i = this.viewerTransformChangeListeners.indexOf(listener)
		if (i > -1) {
			this.viewerTransformChangeListeners.splice(i, 1);
		}
	}


	
	getSidebarVisible() {
		return this.sidebarVisible;
	}

	setSidebarVisible(state) {
		this.sidebarVisible = state;
		this.sidebarListeners.forEach((listener) => {
			listener(this.sidebarVisible);
		})
	}

	onSidebarVisibleChange(listener) {
		this.sidebarListeners.push(listener);
	}

	removeSidebarVisibleChange(listener) {
		let i = this.sidebarListeners.indexOf(listener)
		if (i > -1) {
			this.sidebarListeners.splice(i, 1);
		}
	}
	
	

	getColors() {
		return this.colors;
	}

}

export let BackendAPI = new API();
