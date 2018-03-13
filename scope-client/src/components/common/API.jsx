class API {
	constructor() {
		this.GBC = require("grpc-bus-websocket-client");
		this.GBCConnection = new this.GBC("ws://" + BACKEND.host + ":" + BACKEND.WSport + "/", 'src/proto/s.proto', { scope: { Main: BACKEND.host + ":" + BACKEND.RPCport } }).connect();

		this.loomFiles = [];
		this.activePage = 'welcome';
		this.activePageListeners = [];
		this.activeLooms = [];
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

		this.maxValues = [0, 0, 0];
		this.customValues = [0, 0, 0];
		this.customValuesChangeListeners = [];
	}

	getConnection() {
		return this.GBCConnection;
	}



	getActiveLoom() {
		return this.activeLooms[0];
	}

	getActiveLooms() {
		return this.activeLooms;
	}

	setActiveLooms(looms) {
		this.activeLooms = looms.slice(0);
		this.getMaxScale(null, (customValues, maxValues) => {
			this.customValuesChangeListeners.forEach((listener) => {
				listener(customValues);
			})
		})
	}

	setActiveLoom(loom, id) {
		if (id == null) id = 0;
		this.activeLooms[id] = loom;
		this.activeLoomChangeListeners.forEach((listener) => {
			listener(this.activeLooms[0], this.loomFiles[this.activeLooms[0]], this.activeCoordinates);
		})
		this.getMaxScale(null, (customValues, maxValues) => {
			this.customValuesChangeListeners.forEach((listener) => {
				listener(customValues);
			})
		})
	}

	setActiveCoordinates(coords) {
		this.activeCoordinates = coords;
		this.activeLoomChangeListeners.forEach((listener) => {
			listener(this.activeLooms[0],  this.loomFiles[this.activeLooms[0]], this.activeCoordinates);
		})
	}

	getLoomMetadata(loomFilePath) {
		return this.loomFiles[loomFilePath];
	}

	getActiveLoomMetadata() {
		return this.loomFiles[this.activeLooms[0]];
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

	setActiveFeature(featureId, type, featureType, feature, threshold, metadata) {
		let page = this.activePage;
		let selectedFeatures = this.features[page] || [this.emptyFeature, this.emptyFeature, this.emptyFeature];
		selectedFeatures[featureId] = {type: type, featureType: featureType ? featureType : '', feature: feature ? feature : '', threshold: threshold, metadata: metadata};
		this.features[page] = selectedFeatures;
		this.getMaxScale(featureId, (customValues, maxValues) => {
			(this.featureChangeListeners[page] || []).forEach((listener) => {
				listener(selectedFeatures, featureId, customValues, maxValues);
			})
		})
	}

	getMaxScale(id, callback) {
		let settings = this.getSettings();
		let selectedFeatures = this.features[this.activePage];
		if (!selectedFeatures) return;
		let query = {
			loomFilePath: this.getActiveLooms(),
			feature: selectedFeatures.map(f => {return f.feature}),
			featureType: selectedFeatures.map(f=> {return f.featureType}),
			hasLogTransform: settings.hasLogTransform,
			hasCpmTransform: settings.hasCpmNormalization,
		}
		if (DEBUG) console.log('getVmax', query);
		BackendAPI.getConnection().then((gbc) => {
			gbc.services.scope.Main.getVmax(query, (err, response) => {
				if (DEBUG) console.log('getVmax', response);
				if (id != null) this.customValues[id] = response.vmax[id];
				else this.customValues = response.vmax;
				this.maxValues = response.maxVmax;
				callback(this.customValues, this.maxValues);
			})
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

	getParsedFeatures() {
		let features = this.getActiveFeatures();
		let metadata = this.getActiveLoomMetadata();
		let selectedGenes = [];
		let selectedRegulons = [];
		let selectedClusters = [];
		features.map(f => {
			if (f.featureType == 'gene') selectedGenes.push(f.feature);
			if (f.featureType == 'regulon') selectedRegulons.push(f.feature);
			if (f.featureType.indexOf('Clustering:') == 0) {
				metadata.cellMetaData.clusterings.map( clustering => {
					if (f.featureType.indexOf(clustering.name) != -1) {
						clustering.clusters.map(c => {
							if (c.description == f.feature) {
								selectedClusters.push({clusteringName: clustering.name, clusteringID: clustering.id, clusteName: c.name, clusterID: c.id});
							}
						})
					}
				})
			}
		})
		return { selectedGenes, selectedRegulons, selectedClusters }
	}


	getFeatureScale() {
		return this.maxValues;
	}


	getCustomScale() {
		return this.customValues;
	}

	setCustomScale(scale) {
		this.customValues = scale.slice(0);
		this.customValuesChangeListeners.forEach((listener) => {
			listener(this.customValues);
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
		this.maxValues = [0, 0, 0];
		this.customValues = [0, 0, 0];
		this.activePage = page;
		this.activePageListeners.forEach((listener) => {
			listener(this.activePage);
		})
	}

	onActivePageChange(listener) {
		this.activePageListeners.push(listener);
	}

	removeActivePageChange(listener) {
		let i = this.activePageListeners.indexOf(listener)
		if (i > -1) {
			this.activePageListeners.splice(i, 1);
		}
	}
	

	getSettings() {
		return this.settings;
	}

	setSetting(key, value) {
		this.settings[key] = value;
		this.getMaxScale(null, (customValues, maxValues) => {
			this.settingsChangeListeners.forEach((listener) => {
				listener(this.settings, customValues, maxValues);
			})
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
