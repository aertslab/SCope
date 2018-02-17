class API {
	constructor() {
		this.GBC = require("grpc-bus-websocket-client");
		this.GBCConnection = new this.GBC("ws://localhost:8081/", 'src/proto/s.proto', { scope: { Main: 'localhost:50052' } }).connect();
		this.activeLoom = null;
		this.features = {
			0: {type: '', value: ''},
			1: {type: '', value: ''},
			2: {type: '', value: ''}
		};
		this.featureChangeListeners = [];
		this.activeLoomChangeListeners = [];
	}

	getConnection() {
		return this.GBCConnection;
	}

	setActiveLoom(loom) {
		this.activeLoom = loom;
		this.activeLoomChangeListeners.forEach((listener) => {
			listener(this.activeLoom);
		})
	}

	getActiveLoom() {
		return this.activeLoom;
	}

	setActiveFeature(featureId, featureType, featureValue) {
		this.features[featureId] = { type: featureType, value: featureValue }
		this.featureChangeListeners.forEach((listener) => {
			listener(this.features);
		})
	}

	getActiveFeatures() {
		return this.features;
	}

	onActiveFeaturesChange(listener) {
		this.featureChangeListeners.push(listener);
	}

	onActiveLoomChange(listener) {
		this.activeLoomChangeListeners.push(listener);
	}

}

export let BackendAPI = new API();