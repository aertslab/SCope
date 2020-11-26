class API {
    constructor() {
        this.GBC = require('grpc-bus-websocket-client');
        try {
            this.WSport = document.head
                .querySelector('[name=scope-wsport]')
                .getAttribute('port');
            console.log('Using meta WSport');
        } catch (ex) {
            console.log('Using config WSport');
            this.WSport = BACKEND.WSport;
        }
        try {
            this.RPCport = document.head
                .querySelector('[name=scope-rpcport]')
                .getAttribute('port');
            console.log('Using meta RPCport');
        } catch (ex) {
            this.RPCport = BACKEND.RPCport;
            console.log('Using config RPCport');
        }
        console.log(this.WSport, this.RPCport);

        try {
            if (REVERSEPROXYON) {
                this.GBCConnection = new this.GBC(
                    FRONTEND.wsProtocol + '://' + FRONTEND.host + '/protobuf/',
                    'src/proto/s.proto',
                    { scope: { Main: BACKEND.host + ':' + this.RPCport } }
                ).connect();
            } else {
                this.GBCConnection = new this.GBC(
                    BACKEND.wsProtocol +
                        '://' +
                        BACKEND.host +
                        ':' +
                        this.WSport +
                        '/',
                    'src/proto/s.proto',
                    { scope: { Main: BACKEND.host + ':' + this.RPCport } }
                ).connect();
            }
            console.log(this.GBCConnection);
            this.connected = true;
        } catch (ex) {
            this.GBCConnection = null;
            this.connected = false;
        }

        this.spriteSettings = {
            scale: 5,
            alpha: 1,
        };
        this.spriteSettingsChangeListeners = [];

        this.loomFiles = [];
        this.activePage = 'welcome';
        this.activePageListeners = [];
        this.activeLooms = [];
        this.activeCoordinates = -1;
        this.activeLoomChangeListeners = [];

        this.features = {};
        this.emptyFeature = {
            type: '',
            featureType: '',
            feature: '',
            threshold: 0,
        };

        this.featureChangeListeners = {};

        this.settings = {
            hideTrajectory: false,
            sortCells: true,
            hasLogTransform: true,
            hasCpmNormalization: false,
            dissociateViewers: true,
            showLabels: true,
            labelSize: 12,
        };
        this.settingsChangeListeners = [];

        this.viewerTool = 's-zoom';
        this.viewerToolChangeListeners = [];

        this.viewerSelections = {};
        this.viewerSelectionsChangeListeners = [];

        this.viewerTransform = null;
        this.viewerTransformChangeListeners = [];

        this.sidebarVisible = true;
        this.sidebarListeners = [];

        this.colors = ['red', 'green', 'blue'];

        this.maxValues = {};
        this.maxValuesChangeListeners = [];
        this.emptyColorScale = [
            [0, 0],
            [0, 0],
            [0, 0],
        ];
        this.customValues = {};
        this.customValuesChangeListeners = [];

        this.uuid = null;
        this.sessionMode = null;
        this.updateListeners = [];
    }

    importObject(api) {
        this.spriteSettings = api.spriteSettings;
        this.activePage = api.activePage;
        this.activeLooms = api.activeLooms;
        this.activeCoordinates = api.activeCoordinates;
        this.features = api.features;
        this.settings = api.settings;
        this.viewerTool = api.viewerTool;
        this.viewerSelections = api.viewerSelections;
        this.sidebarVisible = api.sidebarVisible;
        this.maxValues = api.maxValues;
        this.customValues = api.customValues;
    }

    getExportObject(params) {
        this.loom = params.loom;
        this.page = params.page;
        return this;
    }

    getExportKeys() {
        return [
            'loom',
            'page',
            'spriteSettings',
            'scale',
            'alpha',
            'activePage',
            'activeLooms',
            'activeCoordinates',
            'features',
            'gene',
            'regulon',
            'compare',
            'feature',
            'featureType',
            'threshold',
            'type',
            'metadata',
            'description',
            'settings',
            'hasCpmNormalization',
            'hasLogTransform',
            'sortCells',
            'dissociateViewers',
            'hideTrajectory',
            'viewerTool',
            'viewerSelections',
            'viewerTransform',
            'sidebarVisible',
            'maxValues',
            'customValues',
        ];
    }

    onUpdate(listener) {
        this.updateListeners.push(listener);
    }

    removeOnUpdate(listener) {
        let i = this.updateListeners.indexOf(listener);
        if (i > -1) {
            this.updateListeners.splice(i, 1);
        }
    }

    forceUpdate() {
        this.updateListeners.forEach((listener) => {
            listener(this.settings);
        });
    }

    isConnected() {
        return this.connected;
    }

    showError() {
        this.connected = false;
    }

    getConnection() {
        return this.GBCConnection;
    }

    setSpriteSettings(scale, alpha) {
        this.spriteSettings.scale = scale;
        this.spriteSettings.alpha = alpha;
        this.spriteSettingsChangeListeners.forEach((listener) => {
            listener(this.spriteSettings);
        });
    }

    getSpriteSettings() {
        return this.spriteSettings;
    }

    onSpriteSettingsChange(listener) {
        this.spriteSettingsChangeListeners.push(listener);
    }

    removeSpriteSettingsChange(listener) {
        let i = this.spriteSettingsChangeListeners.indexOf(listener);
        if (i > -1) {
            this.spriteSettingsChangeListeners.splice(i, 1);
        }
    }

    getUUIDFromIP(onSuccess) {
        const publicIp = require('public-ip');
        publicIp.v4().then((ip) => {
            this.obtainNewUUID(ip, onSuccess);
        });
    }

    obtainNewUUID(ip, onSuccess) {
        BackendAPI.getConnection().then((gbc) => {
            let query = {
                ip: ip,
            };
            if (DEBUG) console.log('getUUIDAPI', query);
            gbc.services.scope.Main.getUUID(query, (err, response) => {
                if (DEBUG) console.log('getUUIDAPI', response);
                if (response != null)
                    onSuccess(response.UUID, response.timeout);
            });
        });
    }
    getActiveLoom() {
        return this.activeLooms[0];
    }

    getActiveLooms() {
        return this.activeLooms;
    }

    setActiveLooms(looms) {
        this.activeLooms = looms.slice(0);
        this.activeCoordinates = -1;
        this.getMaxScale(null, (customValues, maxValues) => {
            this.customValuesChangeListeners.forEach((listener) => {
                listener(customValues);
            });
        });
    }

    setActiveLoom(loom, id) {
        if (id == null) id = 0;
        if (this.activeLooms[id] == loom) return;
        this.activeLooms[id] = loom;
        this.viewerSelections = {};
        this.viewerSelections[this.activePage] = [];
        this.viewerSelectionsChangeListeners.forEach((listener) => {
            listener(this.viewerSelections[this.activePage]);
        });
        this.activeCoordinates = -1;
        this.activeLoomChangeListeners.forEach((listener) => {
            listener(
                this.activeLooms[0],
                this.loomFiles[this.activeLooms[0]],
                this.activeCoordinates
            );
        });
        this.getMaxScale(null, (customValues, maxValues) => {
            this.customValuesChangeListeners.forEach((listener) => {
                listener(customValues);
            });
        });
    }

    setActiveCoordinates(coords) {
        this.activeCoordinates = coords;
        this.activeLoomChangeListeners.forEach((listener) => {
            listener(
                this.activeLooms[0],
                this.loomFiles[this.activeLooms[0]],
                this.activeCoordinates
            );
        });
    }

    getLoomMetadata(loomFilePath) {
        return this.loomFiles[loomFilePath];
    }

    getActiveLoomMetadata() {
        return this.loomFiles[this.activeLooms[0]];
    }

    getActiveLoomMetadataEmbeddings() {
        return this.loomFiles[this.activeLooms[0]].cellMetaData.embeddings;
    }

    getActiveLoomMetaDataEmbedding() {
        return this.getActiveLoomMetadataEmbeddings().filter(
            (x) => x.id == this.getActiveCoordinates()
        )[0];
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

    hasActiveCoordinatesTrajectory() {
        if (this.getActiveLoomMetaDataEmbedding() == undefined) return false;
        if (!('trajectory' in this.getActiveLoomMetaDataEmbedding()))
            return false;
        return this.getActiveLoomMetaDataEmbedding().trajectory != null;
    }

    getActiveCoordinatesTrajectory() {
        if (!this.hasActiveCoordinatesTrajectory()) return null;
        return this.getActiveLoomMetaDataEmbedding().trajectory;
    }

    queryLoomFiles(uuid, callback, loomFile = null) {
        let query = {
            UUID: uuid,
        };

        console.log(loomFile);
        if (loomFile) {
            query['loomFile'] = loomFile;
        }

        this.getConnection().then(
            (gbc) => {
                if (DEBUG) console.log('getMyLooms', query);
                gbc.services.scope.Main.getMyLooms(query, (error, response) => {
                    if (response !== null) {
                        if (DEBUG) console.log('getMyLooms', response);
                        BackendAPI.setLoomFiles(
                            response.myLooms,
                            response.update
                        );
                        callback(response.myLooms);
                    } else {
                        console.log('No loom files detected');
                        callback([]);
                    }
                });
            },
            () => {
                this.showError();
            }
        );
    }

    getLoomFiles() {
        return this.loomFiles;
    }

    setLoomFiles(files, update) {
        if (!update) {
            this.loomFiles = {};
        }
        Object.keys(files).map((i) => {
            let file = files[i];
            this.loomFiles[file.loomFilePath] = file;
        });
        // TODO: Hacky implementation. To be refactored/reviewed properly
        if (!update) {
            this.activeLoomChangeListeners.forEach((listener) => {
                listener(
                    this.activeLooms[0],
                    this.loomFiles[this.activeLooms[0]],
                    this.activeCoordinates
                );
            });
        }
    }

    getActiveFeatures() {
        return this.features[this.activePage]
            ? this.features[this.activePage]
            : [];
    }

    setActiveFeature(
        featureId,
        type,
        featureType,
        feature,
        threshold,
        metadata,
        page
    ) {
        page = page || this.activePage;
        let selectedFeatures = this.features[page] || [
            this.emptyFeature,
            this.emptyFeature,
            this.emptyFeature,
        ];
        selectedFeatures[featureId] = {
            type: type,
            featureType: featureType ? featureType : '',
            feature: feature ? feature : '',
            threshold: threshold,
            metadata: metadata,
        };
        this.features[page] = selectedFeatures;
        this.getMaxScale(featureId, (customValues, maxValues) => {
            (this.featureChangeListeners[page] || []).forEach((listener) => {
                listener(selectedFeatures, featureId, customValues, maxValues);
            });
        });
        console.log('Active feature: ' + feature + ' (' + featureType + ')');
    }

    setAnnotationName(feature, newAnnoName, featureIndex, uuid) {
        let clusteringID = feature.metadata['clusteringID'];
        let clusterID = feature.metadata['clusterID'];
        let loomFilePath = this.getActiveLoom();

        if (newAnnoName != '') {
            let setAnnotationNameQuery = {
                loomFilePath: loomFilePath,
                clusteringID: clusteringID,
                clusterID: clusterID,
                newAnnoName: newAnnoName,
            };
            this.getConnection().then(
                (gbc) => {
                    if (DEBUG)
                        console.log(
                            'setAnnotationName',
                            setAnnotationNameQuery
                        );
                    gbc.services.scope.Main.setAnnotationName(
                        setAnnotationNameQuery,
                        (setAnnotationNameErr, setAnnotationNameResponse) => {
                            if (setAnnotationNameResponse.success) {
                                BackendAPI.queryLoomFiles(
                                    uuid,
                                    () => {
                                        BackendAPI.getActiveFeatures().forEach(
                                            (f, n) => {
                                                if (
                                                    f.metadata[
                                                        'clusteringID'
                                                    ] == clusteringID &&
                                                    f.metadata['clusterID'] ==
                                                        clusterID
                                                ) {
                                                    BackendAPI.updateFeature(
                                                        n,
                                                        f.type,
                                                        newAnnoName,
                                                        f.featureType,
                                                        f.metadata
                                                            ? f.metadata
                                                                  .description
                                                            : null,
                                                        ''
                                                    );
                                                }
                                            }
                                        );
                                    },
                                    loomFilePath
                                );
                            }
                        }
                    );
                },
                () => {
                    this.showError();
                }
            );
        }
    }

    setLoomHierarchy(L1, L2, L3, callback) {
        let setLoomHierarchyQuery = {
            loomFilePath: this.getActiveLoom(),
            newHierarchy_L1: L1,
            newHierarchy_L2: L2,
            newHierarchy_L3: L3,
        };
        this.getConnection().then(
            (gbc) => {
                if (DEBUG)
                    console.log('setLoomHierarchy', setLoomHierarchyQuery);
                gbc.services.scope.Main.setLoomHierarchy(
                    setLoomHierarchyQuery,
                    (setLoomHierarchyErr, setLoomHierarchyResponse) => {
                        callback(setLoomHierarchyResponse);
                    }
                );
            },
            () => {
                this.showError();
            }
        );
    }

    getNextCluster(clusteringID, clusterID, direction, callback) {
        let query = {
            loomFilePath: this.getActiveLoom(),
            clusteringID: clusteringID,
            clusterID: clusterID,
            direction: direction,
        };
        this.getConnection().then((gbc) => {
            if (DEBUG) console.log('getNextCluster', query);
            gbc.services.scope.Main.getNextCluster(query, (err, response) => {
                // TODO: Hacky implementation. To be refactored/reviewed properly
                BackendAPI.queryLoomFiles(
                    this.uuid,
                    () => {
                        callback(response);
                    },
                    this.getActiveLoom()
                );
            });
        });
    }

    updateFeature(field, type, feature, featureType, featureDescription, page) {
        if (featureType == 'regulon') {
            let regulonQuery = {
                loomFilePath: this.getActiveLoom(),
                regulon: feature,
            };
            this.getConnection().then(
                (gbc) => {
                    if (DEBUG) console.log('getRegulonMetaData', regulonQuery);
                    gbc.services.scope.Main.getRegulonMetaData(
                        regulonQuery,
                        (regulonErr, regulonResponse) => {
                            if (DEBUG)
                                console.log(
                                    'getRegulonMetaData',
                                    regulonResponse
                                );
                            let metadata = regulonResponse
                                ? regulonResponse.regulonMeta
                                : {};
                            let threshold = 0;
                            if (metadata.autoThresholds) {
                                metadata.autoThresholds.map((t) => {
                                    if (t.name == metadata.defaultThreshold)
                                        threshold = t.threshold;
                                });
                            }
                            metadata.description = featureDescription;
                            this.setActiveFeature(
                                field,
                                type,
                                featureType,
                                feature,
                                threshold,
                                metadata,
                                page
                            );
                        }
                    );
                },
                () => {
                    this.showError();
                }
            );
        } else if (featureType.indexOf('Clustering:') == 0) {
            let loomMetadata = this.getActiveLoomMetadata();
            let clusteringID, clusterID, cellTypeAnno, clusteringGroup;
            loomMetadata.cellMetaData.clusterings.map((clustering) => {
                const clusteringName = featureType.replace('Clustering: ', '');
                if (clusteringName == clustering.name) {
                    clusteringID = clustering.id;
                    clusteringGroup = clustering.group;
                    clustering.clusters.map((c) => {
                        if (c.description == feature) {
                            clusterID = c.id;
                            cellTypeAnno = c.cell_type_annotation;
                        }
                    });
                }
            });
            if (clusterID != null) {
                let markerQuery = {
                    loomFilePath: this.getActiveLoom(),
                    clusterID: clusterID,
                    clusteringID: clusteringID,
                };
                this.getConnection().then(
                    (gbc) => {
                        if (DEBUG) console.log('getMarkerGenes', markerQuery);
                        gbc.services.scope.Main.getMarkerGenes(
                            markerQuery,
                            (markerErr, markerResponse) => {
                                if (DEBUG)
                                    console.log(
                                        'getMarkerGenes',
                                        markerResponse
                                    );
                                if (!markerResponse) markerResponse = {};
                                markerResponse.description = featureDescription;
                                this.setActiveFeature(
                                    field,
                                    type,
                                    featureType,
                                    feature,
                                    0,
                                    {
                                        ...markerResponse,
                                        clusterID: clusterID,
                                        clusteringID: clusteringID,
                                        cellTypeAnno: cellTypeAnno,
                                        clusteringGroup: clusteringGroup,
                                    },
                                    page
                                );
                            }
                        );
                    },
                    () => {
                        this.showError();
                    }
                );
            } else {
                this.setActiveFeature(
                    field,
                    type,
                    featureType,
                    feature,
                    0,
                    {
                        description: featureDescription,
                        clusteringGroup: clusteringGroup,
                    },
                    page
                );
            }
        } else {
            this.setActiveFeature(
                field,
                type,
                featureType,
                feature,
                0,
                { description: featureDescription },
                page
            );
        }
    }

    setFeatureThreshold(id, threshold) {
        let page = this.activePage;
        let selectedFeatures = this.features[page] || [
            this.emptyFeature,
            this.emptyFeature,
            this.emptyFeature,
        ];
        selectedFeatures[id].threshold = threshold;
        this.features[page] = selectedFeatures;
        (this.featureChangeListeners[page] || []).forEach((listener) => {
            listener(
                selectedFeatures,
                id,
                this.customValues[page],
                this.maxValues[page]
            );
        });
    }

    getORCIDStatus(callback) {
        BackendAPI.getConnection().then(
            (gbc) => {
                gbc.services.scope.Main.getORCIDStatus({}, (err, response) => {
                    if (DEBUG) console.log('getORCIDStatus', response);
                    callback(response.active);
                });
            },
            () => {
                this.showError();
            }
        );
    }

    getORCID(auth_code, callback) {
        if (DEBUG) console.log('getORCID', auth_code);
        BackendAPI.getConnection().then(
            (gbc) => {
                gbc.services.scope.Main.getORCID(
                    { auth_code },
                    (err, response) => {
                        if (DEBUG) console.log('getORCID', response);
                        if (response.success) {
                            callback(
                                response.orcid_scope_uuid,
                                response.name,
                                response.orcid_id
                            );
                        } else {
                            console.log('ORCID AUTH FAILED');
                        }
                    }
                );
            },
            () => {
                this.showError();
            }
        );
    }

    setColabAnnotationData(feature, annotationData, orcidInfo, uuid, callback) {
        if (DEBUG)
            console.log(
                'setColabAnnotationData',
                feature,
                annotationData,
                orcidInfo
            );
        let loomFilePath = this.getActiveLoom();
        let query = {
            loomFilePath: loomFilePath,
            clusteringID: feature.metadata['clusteringID'],
            clusterID: feature.metadata['clusterID'],
            orcidInfo: orcidInfo,
            annoData: {
                curator_name: orcidInfo['orcidName'],
                curator_id: orcidInfo['orcidID'],
                timestamp: new Date().getTime(),
                obo_id: annotationData['obo_id'],
                ols_iri: annotationData['iri'],
                annotation_label: annotationData['label'],
                markers: annotationData['selectedMarkers'],
                publication: annotationData['publication'],
                comment: annotationData['comment'],
            },
        };
        if (DEBUG) console.log('setColabAnnotationData', query);
        BackendAPI.getConnection().then(
            (gbc) => {
                gbc.services.scope.Main.setColabAnnotationData(
                    query,
                    (err, response) => {
                        if (DEBUG)
                            console.log('setColabAnnotationData', response);
                        if (response.success) {
                            BackendAPI.queryLoomFiles(
                                uuid,
                                () => {
                                    BackendAPI.getActiveFeatures().forEach(
                                        (f, n) => {
                                            if (f === feature) {
                                                BackendAPI.updateFeature(
                                                    n,
                                                    f.type,
                                                    f.feature,
                                                    f.featureType,
                                                    f.metadata
                                                        ? f.metadata.description
                                                        : null,
                                                    ''
                                                );
                                            }
                                        }
                                    );
                                },
                                loomFilePath
                            );
                        }
                        callback(response);
                    }
                );
            },
            () => {
                this.showError();
            }
        );
    }

    voteAnnotation(direction, data, feature, orcidInfo, uuid, callback) {
        if (DEBUG) console.log('voteUpAnnotation');
        let loomFilePath = this.getActiveLoom();

        let query = {
            loomFilePath: loomFilePath,
            clusteringID: feature.metadata['clusteringID'],
            clusterID: feature.metadata['clusterID'],
            orcidInfo: orcidInfo,
            annoData: data,
            direction: direction,
        };
        if (DEBUG) console.log('voteAnnotation', query);
        BackendAPI.getConnection().then(
            (gbc) => {
                gbc.services.scope.Main.voteAnnotation(
                    query,
                    (err, response) => {
                        if (DEBUG) console.log('voteAnnotation', response);
                        if (response.success) {
                            BackendAPI.queryLoomFiles(
                                uuid,
                                () => {
                                    BackendAPI.getActiveFeatures().forEach(
                                        (f, n) => {
                                            // if (f.metadata['clusteringID'] == feature.metadata['clusteringID'] && f.metadata['clusterID'] == feature.metadata['clusterID']) {
                                            if (f == feature) {
                                                BackendAPI.updateFeature(
                                                    n,
                                                    f.type,
                                                    f.feature,
                                                    f.featureType,
                                                    f.metadata
                                                        ? f.metadata.description
                                                        : null,
                                                    ''
                                                );
                                            }
                                        }
                                    );
                                },
                                loomFilePath
                            );
                        }
                        callback(response);
                    }
                );
            },
            () => {
                this.showError();
            }
        );
    }

    getMaxScale(id, callback) {
        let settings = this.getSettings();
        let page = this.activePage;
        let selectedFeatures = this.features[page];
        if (!selectedFeatures) return;
        if (DEBUG) console.log('getMaxScale', id, page);
        let query = {
            loomFilePath: this.getActiveLooms(),
            feature: selectedFeatures.map((f) => {
                return page == 'regulon' ? f.feature.split('_')[0] : f.feature;
            }),
            featureType: selectedFeatures.map((f) => {
                return page == 'regulon' ? 'gene' : f.featureType;
            }),
            hasLogTransform: settings.hasLogTransform,
            hasCpmTransform: settings.hasCpmNormalization,
        };
        if (DEBUG) console.log('getVmax', query);
        BackendAPI.getConnection().then(
            (gbc) => {
                gbc.services.scope.Main.getVmax(query, (err, response) => {
                    if (DEBUG) console.log('getVmax', response);
                    if (id != null)
                        this.customValues[page][id][1] = response.vmax[id];
                    else
                        this.customValues[page] = response.vmax.map((x) => [
                            0,
                            x,
                        ]);
                    this.maxValues[page] = response.maxVmax;
                    this.maxValuesChangeListeners.forEach((listener) => {
                        listener(this.maxValues[page]);
                    });
                    callback(this.customValues[page], this.maxValues[page]);
                });
            },
            () => {
                this.showError();
            }
        );
    }

    onFeatureScaleChange(listener) {
        this.maxValuesChangeListeners.push(listener);
    }

    removeFeatureScaleChange(listener) {
        let i = this.maxValuesChangeListeners.indexOf(listener);
        if (i > -1) {
            this.maxValuesChangeListeners.splice(i, 1);
        }
    }

    onActiveFeaturesChange(page, listener) {
        if (!this.featureChangeListeners[page])
            this.featureChangeListeners[page] = [];
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
        features.map((f) => {
            if (f.featureType == 'gene') selectedGenes.push(f.feature);
            if (f.featureType == 'regulon') selectedRegulons.push(f.feature);
            if (f.featureType.indexOf('Clustering:') == 0) {
                metadata.cellMetaData.clusterings.map((clustering) => {
                    if (f.featureType.indexOf(clustering.name) != -1) {
                        clustering.clusters.map((c) => {
                            if (c.description == f.feature) {
                                selectedClusters.push({
                                    clusteringName: clustering.name,
                                    clusteringID: clustering.id,
                                    clusteName: c.name,
                                    clusterID: c.id,
                                });
                            }
                        });
                    }
                });
            }
        });
        return { selectedGenes, selectedRegulons, selectedClusters };
    }

    getFeatureScale() {
        return this.maxValues[this.activePage] || [0, 0, 0];
    }

    getCustomScale() {
        return this.customValues[this.activePage] || this.emptyColorScale;
    }

    setCustomScale(scale) {
        this.customValues[this.activePage] = scale.slice(0);
        this.customValuesChangeListeners.forEach((listener) => {
            listener(this.customValues[this.activePage]);
        });
    }

    onCustomScaleChange(listener) {
        this.customValuesChangeListeners.push(listener);
    }

    removeCustomScaleChange(listener) {
        let i = this.customValuesChangeListeners.indexOf(listener);
        if (i > -1) {
            this.customValuesChangeListeners.splice(i, 1);
        }
    }

    getActivePage() {
        return this.activePage;
    }

    setActivePage(page) {
        this.maxValues[page] = this.maxValues[page] || [0, 0, 0];
        this.customValues[page] =
            this.customValues[page] || this.emptyColorScale;
        this.activePage = page;
        this.activePageListeners.forEach((listener) => {
            listener(this.activePage);
        });
    }

    onActivePageChange(listener) {
        this.activePageListeners.push(listener);
    }

    removeActivePageChange(listener) {
        let i = this.activePageListeners.indexOf(listener);
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
            });
        });
        return this.settings;
    }

    onSettingsChange(listener) {
        this.settingsChangeListeners.push(listener);
    }

    removeSettingsChange(listener) {
        let i = this.settingsChangeListeners.indexOf(listener);
        if (i > -1) {
            this.settingsChangeListeners.splice(i, 1);
        }
    }

    getViewerTool() {
        return this.viewerTool;
    }

    setViewerTool(tool) {
        this.viewerTool = tool;
        this.viewerToolChangeListeners.forEach((listener) => {
            listener(this.viewerTool);
        });
    }

    onViewerToolChange(listener) {
        this.viewerToolChangeListeners.push(listener);
    }

    removeViewerToolChange(listener) {
        let i = this.viewerToolChangeListeners.indexOf(listener);
        if (i > -1) {
            this.viewerToolChangeListeners.splice(i, 1);
        }
    }

    getViewerSelections() {
        return this.viewerSelections[this.activePage] || [];
    }

    addViewerSelection(selection) {
        if (!this.viewerSelections[this.activePage])
            this.viewerSelections[this.activePage] = [];
        BackendAPI.getConnection().then((gbc) => {
            let query = {
                loomFilePath: BackendAPI.getActiveLoom(),
                cellIndices: selection.points,
            };
            if (DEBUG) {
                console.debug('getClusterOverlaps', query);
            }
            gbc.services.scope.Main.getClusterOverlaps(
                query,
                (err, response) => {
                    console.debug('getClusterOverlaps', response);
                    if (response) {
                        const clusterOverlaps = response.clusterOverlaps.map(
                            (clusterOverlap) => {
                                clusterOverlap[
                                    'cells_in_cluster'
                                ] = clusterOverlap['cells_in_cluster'].toFixed(
                                    2
                                );
                                clusterOverlap[
                                    'cluster_in_cells'
                                ] = clusterOverlap['cluster_in_cells'].toFixed(
                                    2
                                );
                                return clusterOverlap;
                            }
                        );
                        selection['clusterOverlaps'] = clusterOverlaps;
                    }
                    this.viewerSelections[this.activePage].push(selection);
                    this.viewerSelectionsChangeListeners.forEach((listener) => {
                        listener(this.viewerSelections[this.activePage]);
                    });
                }
            );
        });
    }

    removeViewerSelection(index) {
        this.viewerSelections[this.activePage].splice(index, 1);
        this.viewerSelectionsChangeListeners.forEach((listener) => {
            listener(this.viewerSelections[this.activePage]);
        });
    }

    onViewerSelectionsChange(listener) {
        this.viewerSelectionsChangeListeners.push(listener);
    }

    removeViewerSelectionsChange(listener) {
        let i = this.viewerSelectionsChangeListeners.indexOf(listener);
        if (i > -1) {
            this.viewerSelectionsChangeListeners.splice(i, 1);
        }
    }

    clearViewerSelections() {
        this.viewerSelections[this.activePage] = [];
    }

    toggleLassoSelection(index) {
        this.viewerSelections[this.activePage][index].selected = !this
            .viewerSelections[this.activePage][index].selected;
        this.viewerSelectionsChangeListeners.forEach((listener) => {
            listener(this.viewerSelections[this.activePage]);
        });
        return this.viewerSelections[this.activePage][index].selected;
    }

    setViewerTransform(transform) {
        this.viewerTransform = transform;
        this.viewerTransformChangeListeners.forEach((listener) => {
            listener(this.viewerTransform);
        });
    }

    getViewerTransform() {
        return this.viewerTransform;
    }

    onViewerTransformChange(listener) {
        this.viewerTransformChangeListeners.push(listener);
    }

    removeViewerTransformChange(listener) {
        let i = this.viewerTransformChangeListeners.indexOf(listener);
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
        });
    }

    onSidebarVisibleChange(listener) {
        this.sidebarListeners.push(listener);
    }

    removeSidebarVisibleChange(listener) {
        let i = this.sidebarListeners.indexOf(listener);
        if (i > -1) {
            this.sidebarListeners.splice(i, 1);
        }
    }

    setUUID(uuid) {
        this.uuid = uuid;
    }

    getUUID() {
        return this.uuid;
    }

    setSessionMode(sessionMode) {
        this.sessionMode = sessionMode;
    }

    getSessionMode() {
        return this.sessionMode;
    }

    getLoomRWStatus() {
        if (
            /.*\/.*loom$/.test(this.getActiveLoom()) &&
            this.getSessionMode() == 'rw'
        ) {
            return 'rw';
        } else {
            return 'ro';
        }
    }

    getColors() {
        return this.colors;
    }
}

export let BackendAPI = new API();
