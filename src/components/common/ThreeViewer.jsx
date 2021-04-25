import React, { Component } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BackendAPI } from './API';
import zlib from 'zlib';

const DEFAULT_POINT_COLOR = 'A6A6A6';
const VIEWER_MARGIN = 5;

export default class Viewer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            activeFeatures: BackendAPI.getActiveFeatures(),
            activePage: BackendAPI.getActivePage(),
        };

        this.bcr = null;
        this.w = parseInt(this.props.width);
        this.h = parseInt(this.props.height);
        this.nearPlane = 0.1;
        this.farPlane = 1000;
        this.texture = new THREE.TextureLoader().load('src/images/dot.png');

        this.activeFeaturesListener = (features, featureID, customScale) => {
            this.onActiveFeaturesChange(features, featureID, customScale);
        };
    }

    onMove(event) {
        // Get pos on screen, correct for viewer pos, scale -1 > 1 based on viewer size
        this.pointer.x = ((event.clientX - this.bcr.left) / this.w) * 2 - 1;
        this.pointer.y = -((event.clientY - this.bcr.top) / this.h) * 2 + 1;
    }

    initGraphics() {
        if (DEBUG) console.log('Initializing Viewer ', this.props.name);

        this.scene = new THREE.Scene();

        // Enable hover
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params = { Points: { threshold: 0.01 } };
        this.pointer = new THREE.Vector2();

        this.camera = new THREE.OrthographicCamera(
            -this.w / 2,
            this.w / 2,
            -this.h / 2,
            this.h / 2
        );

        this.camera.position.set(0, 0, this.farPlane);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true, // Allow saving images
        });
        this.renderer.setSize(this.w, this.h);
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.PointsMaterial({
            size: 5,
            vertexColors: true,
            map: this.texture,
            transparent: true,
            depthWrite: false,
            blending: THREE.NoBlending,
        });

        this.controls = new OrbitControls(
            this.camera,
            this.renderer.domElement
        );

        // Disable this always for now, renable selectively for 3-D plots
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: null,
            RIGHT: null,
        };
        this.controls.enableRotate = false;
        this.controls.addEventListener('change', this.renderScene);
    }

    render() {
        return (
            <div
                id={'viewer' + this.props.name}
                ref={(ref) => (this.mount = ref)}
                onPointerMove={this.onMove.bind(this)}
            />
        );
    }

    componentDidMount() {
        if (DEBUG)
            console.log(this.props.name, 'componentDidMount', this.props);

        this.bcr = document
            .getElementById('viewer' + this.props.name)
            .getBoundingClientRect();
        this.w = this.bcr.width - VIEWER_MARGIN;
        this.h = this.bcr.height - VIEWER_MARGIN;

        this.initGraphics();
        this.mount.appendChild(this.renderer.domElement);

        if (this.props.loomFile != null) {
            this.getPoints(
                this.props.loomFile,
                this.props.activeCoordinates,
                this.props.activeAnnotations,
                this.props.superposition,
                () => {
                    if (this.props.colors) {
                        this.updateDataPoints(this.props.colors);
                    } else {
                        this.getFeatureColors(
                            this.state.activeFeatures,
                            this.props.loomFile,
                            this.props.thresholds,
                            this.props.activeAnnotations,
                            this.state.customScale,
                            this.props.superposition
                        );
                        // this.getFeatureLabels(
                        //     this.props.loomFile,
                        //     BackendAPI.getActiveCoordinates(),
                        //     this.state.activeFeatures
                        // );
                    }
                }
            );
        }

        BackendAPI.onActiveFeaturesChange(
            this.state.activePage,
            this.activeFeaturesListener
        );
        this.start();
    }

    componentWillUnmount() {
        BackendAPI.removeActiveFeaturesChange(
            this.state.activePage,
            this.activeFeaturesListener
        );
        this.stop();
    }

    start = () => {
        if (!this.frameId) {
            this.frameId = requestAnimationFrame(this.animate);
        }
    };
    stop = () => {
        cancelAnimationFrame(this.frameId);
    };

    animate = () => {
        this.renderScene();
        this.frameId = window.requestAnimationFrame(this.animate);
    };

    renderScene = () => {
        this.renderer.render(this.scene, this.camera);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(
            this.scene.children,
            true
        );
        if (intersects.length > 0) {
            const res = intersects.filter(function (res) {
                return res && res.object;
            });

            res.map((r) => {
                if (r && r.object) {
                    // TEMP display hovered cell
                    r.object.geometry.attributes.color.array[r.index * 3] = 1;
                    r.object.geometry.attributes.color.needsUpdate = true;
                }
            });
        }
    };

    getPoints(loomFile, coordinates, annotations, superposition, callback) {
        let queryAnnotations = [];
        if (annotations) {
            this.setState({
                activeAnnotations: Object.assign({}, annotations),
            });
            Object.keys(annotations).map((name) => {
                queryAnnotations.push({
                    name: name,
                    values: annotations[name],
                });
            });
        }

        let query = {
            loomFilePath: loomFile,
            coordinatesID: parseInt(coordinates),
            annotation: queryAnnotations,
            logic: superposition,
        };

        if (DEBUG) console.log(this.props.name, 'getCoordinates', query);
        BackendAPI.getConnection().then(
            (gbc) => {
                gbc.services.scope.Main.getCoordinates(
                    query,
                    (err, response) => {
                        // Update the coordinates and remove all previous data points
                        if (DEBUG)
                            console.log(
                                this.props.name,
                                'getCoordinates',
                                response
                            );
                        // this.mainLayer.removeChildren();
                        if (response) {
                            let coord = {
                                idx: response.cellIndices,
                                x: response.x,
                                y: response.y,
                            };

                            // ------------------------------
                            // TESTING OVERLOAD OF CELLS

                            const multiplyCells = 4;
                            let col = 0;
                            const nRows = 2;

                            let mIdx = [];
                            let mX = [];
                            let mY = [];

                            const n = response.cellIndices.length;

                            for (let x = 0; x < multiplyCells; ++x) {
                                if (x % nRows == 0) {
                                    col += 1;
                                }
                                for (let i = 0; i < n; ++i) {
                                    mIdx.push(coord.idx[i] + n * x);
                                    mX.push(coord.x[i] + 100 * (x % nRows));
                                    mY.push(coord.y[i] + 100 * col);
                                }
                            }

                            coord = {
                                idx: mIdx,
                                x: mX,
                                y: mY,
                            };

                            // ------------------------------

                            // If current coordinates has a trajectory set it
                            this.setState({
                                coord: coord,
                            });
                        } else {
                            console.log(
                                'Could not get the coordinates - empty response!'
                            );
                            this.setState({ coord: { idx: [], x: [], y: [] } });
                        }

                        this.initializeDataPoints(callback ? true : false);
                        callback();
                    }
                );
            },
            () => {
                BackendAPI.showError();
            }
        );
    }

    initializeDataPoints(stillLoading) {
        let c = this.state.coord;
        if (c.x.length !== c.y.length)
            throw 'Coordinates does not have the same size.';
        let n = c.x.length;
        let positions = [];
        let colors = [];
        let origData = [];

        for (let i = 0; i < n; ++i) {
            positions.push(c.x[i], c.y[i], 0);
            colors.push(0, 0, 0);
            origData.push(c.idx[i]);
        }

        this.scene.clear();
        this.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        );
        this.geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(colors, 3)
        );
        this.geometry.setAttribute(
            'origData',
            new THREE.Float32BufferAttribute(origData, 1)
        );
        const points = new THREE.Points(this.geometry, this.material);
        this.scene.add(points);
    }

    chunkString(str, length) {
        return str.match(new RegExp('.{1,' + length + '}', 'g'));
    }

    getFeatureColors(
        features,
        loomFile,
        thresholds,
        annotations,
        scale,
        superposition
    ) {
        if (scale) {
            this.setState({
                activeFeatures: JSON.parse(JSON.stringify(features)),
                customScale: scale.slice(0),
            });
        } else {
            this.setState({
                activeFeatures: JSON.parse(JSON.stringify(features)),
            });
        }
        let settings = BackendAPI.getSettings();

        let queryAnnotations = [];
        if (annotations) {
            Object.keys(annotations).map((name) => {
                queryAnnotations.push({
                    name: name,
                    values: annotations[name],
                });
            });
        }

        let query = {
            loomFilePath: loomFile,
            featureType: features.map((f) => {
                return this.props.genes ? 'gene' : f.featureType;
            }),
            feature: features.map((f) => {
                return this.props.genes ? f.feature.split('_')[0] : f.feature;
            }),
            hasLogTransform: settings.hasLogTransform,
            hasCpmTransform: settings.hasCpmNormalization,
            threshold: thresholds
                ? features.map((f) => {
                      return f.threshold;
                  })
                : [0, 0, 0],
            scaleThresholded: this.props.scale,
            annotation: queryAnnotations,
            vmax: [0, 0, 0],
            vmin: [0, 0, 0],
            logic: superposition,
        };
        if (this.props.customScale && scale) {
            query['vmax'] = this.getVmaxes(scale);
            query['vmin'] = this.getVmins(scale);
        }
        if (DEBUG)
            console.log(this.props.name, 'getFeatureColors', query, scale);
        BackendAPI.getConnection().then(
            (gbc) => {
                gbc.services.scope.Main.getCellColorByFeatures(
                    query,
                    (err, response) => {
                        if (response.error !== null) {
                            Alert.alert(
                                response.error.message,
                                response.error.type
                            );
                        } else {
                            if (DEBUG)
                                console.log(
                                    this.props.name,
                                    'getFeatureColors',
                                    response
                                );
                            // Convert object to ArrayBuffer
                            let responseBuffered = new Buffer(
                                response.compressedColor.toArrayBuffer()
                            );
                            // Uncompress
                            if (response.hasAddCompressionLayer) {
                                zlib.inflate(
                                    responseBuffered,
                                    (err, uncompressedMessage) => {
                                        if (err) console.log(err);
                                        else {
                                            let colors = this.chunkString(
                                                uncompressedMessage.toString(),
                                                6
                                            );
                                            this.updateColors(response, colors);
                                        }
                                    }
                                );
                            } else {
                                this.updateColors(response, response.color);
                            }

                            if (this.props.onActiveLegendChange != null) {
                                this.props.onActiveLegendChange(
                                    response.legend
                                );
                            }
                        }
                    }
                );
            },
            () => {
                BackendAPI.showError();
            }
        );
    }

    updateColors = (response, colors) => {
        if (response !== null) {
            // ---- TESTING MULTI CELLS

            if (Number.isInteger(this.state.coord.idx.length / colors.length)) {
                let newCols = [];
                for (
                    let i = 0;
                    i < this.state.coord.idx.length / colors.length;
                    i++
                ) {
                    newCols = newCols.concat(colors);
                }
                colors = newCols;
            }
            // ----

            this.setState({ colors: colors });
            this.updateDataPoints();
        } else {
            console.log('Should reset here?');
        }
    };

    hexToRgb(hex) {
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
              }
            : null;
    }

    updateDataPoints(colors) {
        console.log('Updating points');
        let settings = BackendAPI.getSettings();
        let positions = [];
        let colorsList = [];
        let origData = [];
        if (settings.sortCells) {
            let pts = _.zip(
                this.state.coord.idx,
                this.state.coord.x,
                this.state.coord.y,
                colors ? colors : this.state.colors
            );
            pts.sort((a, b) => {
                let ca = this.hexToRgb(a[3]);
                let cb = this.hexToRgb(b[3]);
                let r =
                    (ca ? ca.r + ca.g + ca.b : 0) -
                    (cb ? cb.r + cb.g + cb.b : 0);
                return r;
            });
            pts.map((p, i) => {
                let rgb;
                if (p[3] == 'XXXXXX') {
                    rgb = this.hexToRgb(DEFAULT_POINT_COLOR);
                } else {
                    rgb = this.hexToRgb(p[3]);
                }
                positions.push(p[1], p[2], 0);
                colorsList.push(rgb.r / 255, rgb.g / 255, rgb.b / 255);
                origData.push(p[0]);
            });
        } else {
            this.state.coord.idx.map((ci, i) => {
                positions.push(this.state.coord.x[i], this.state.coord.y[i], 0);
                colorsList.push(
                    this.state.colors[i].r / 255,
                    this.state.colors[i].g / 255,
                    this.state.colors[i].b / 255
                );
                origData.push(ci);
            });
        }
        this.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        );
        this.geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(colorsList, 3)
        );
        this.geometry.setAttribute(
            'origData',
            new THREE.Float32BufferAttribute(origData, 1)
        );
        this.scene.clear();

        const points = new THREE.Points(this.geometry, this.material);
        this.scene.add(points);
    }

    onActiveFeaturesChange(features, featureID, customScale) {
        if (
            this.getJSONFeatures(features, 'feature') !=
                this.getJSONFeatures(this.state.activeFeatures, 'feature') ||
            this.getJSONFeatures(features, 'featureType') !=
                this.getJSONFeatures(
                    this.state.activeFeatures,
                    'featureType'
                ) ||
            (this.props.thresholds &&
                this.getJSONFeatures(features, 'threshold') !=
                    this.getJSONFeatures(
                        this.state.activeFeatures,
                        'threshold'
                    ))
        ) {
            this.setState({ loading: true });

            let featuresActive = false;
            features.map((f) => {
                if (f.feature.length) featuresActive = true;
            });
            if (featuresActive) {
                this.getFeatureColors(
                    features,
                    this.props.loomFile,
                    this.props.thresholds,
                    this.state.activeAnnotations,
                    customScale,
                    this.props.superposition
                );
                // this.getFeatureLabels(
                //     this.props.loomFile,
                //     BackendAPI.getActiveCoordinates(),
                //     features
                // );
            } else {
                this.setState({
                    activeFeatures: JSON.parse(JSON.stringify(features)),
                    colors: [],
                    featureLabels: [],
                });
                this.resetDataPoints();
            }
        }
    }

    getVmins(scale) {
        return scale.map((x) => x[0]);
    }

    getVmaxes(scale) {
        return scale.map((x) => x[1]);
    }

    getJSONFeatures(features, field) {
        if (features) {
            return JSON.stringify(
                features.map((f) => {
                    return f[field];
                })
            );
        } else {
            return null;
        }
    }
}
