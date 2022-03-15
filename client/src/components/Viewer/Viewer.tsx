import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useDispatch, useSelector } from 'react-redux';
import { Coordinate } from '../../api';
import { RootState } from '../../redux/reducers';
import { getCoordinates } from '../../redux/actions';
import * as R from 'ramda';

export type ViewerProps = {
    project: string;
    dataset: number;
};

const initGraphics = () => {
    const scene = new THREE.Scene();
    // scene.background = new THREE.Color(0x00ff00);
    const height = 1000;
    const width = 1000;
    const camera = new THREE.OrthographicCamera(
        width / -2,
        width / 2,
        height / 2,
        height / -2
    );
    camera.position.set(0, 0, 2000);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);

    // --------------- Start of sprite stuff ----------------
    // const texture = new THREE.TextureLoader().load('src/images/dot.png');
    // const material = new THREE.PointsMaterial({
    //     size: 5,
    //     vertexColors: true,
    //     map: texture,
    //     transparent: true,
    //     depthWrite: false,
    //     blending: THREE.NoBlending,
    // });

    // --------------- End of sprite stuff ----------------

    // --------------- Start of shaders stuff ----------------
    const uniforms = {
        pointTexture: {
            value: new THREE.TextureLoader().load('src/images/dot.png'),
        },
    };

    const vertexShader = `
        attribute float size;
        varying vec3 vColor;
        void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_PointSize = size;
            gl_Position = projectionMatrix * mvPosition;

        }`;
    const fragmentShader = `
        uniform sampler2D pointTexture;
        varying vec3 vColor;
        void main() {
            gl_FragColor = vec4( vColor, 1.0 );
            gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord );
        }`;

    const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true,
        vertexColors: true,
    });

    // --------------- End of shaders stuff ----------------

    const geometry = new THREE.BufferGeometry();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.MIDDLE,
        RIGHT: THREE.MOUSE.RIGHT,
    };
    controls.enableRotate = false;

    const result = {
        renderer,
        scene,
        camera,
        geometry,
        material,
    };

    controls.addEventListener('change', () => renderScene(result));

    return result;
};

const renderScene = ({ renderer, scene, camera }) => {
    if (typeof renderer !== 'undefined') {
        renderer.render(scene, camera);
    }
};

const intitializeDataPoints = (scene, camera, geometry, material, coords) => {
    const x = [] as any;
    const y = [] as any;
    const positions = [] as any;
    const colors = [] as any;
    const sizes = [] as any;

    // const multiplyCells = 50;
    // const nRows = 10;
    // const spacing = 30
    // let col = 0;

    // for (let n = 0; n < multiplyCells; ++n) {
    //     if (n % nRows == 0) {
    //         col += 1;
    //     }
    //     coords.forEach((coord: { x: number; y: number; }) => {
    //         x.push(coord.x + spacing * (n % nRows));
    //         y.push(coord.y + spacing * col);
    //         positions.push(coord.x + spacing * (n % nRows), coord.y + spacing * col, 0);
    //         colors.push(255, 0, 0);
    //         sizes.push(20);
    //     })
    // }
    coords.forEach((coord: { x: number; y: number }) => {
        x.push(coord.x);
        y.push(coord.y);
        positions.push(coord.x, coord.y, 0);
        colors.push(255, 0, 0);
        sizes.push(5);
    });

    console.log(
        'Initializing data points...' + colors.length + ' ' + positions.length
    );
    scene.clear();

    const sorted_x = R.sort(R.subtract, x);
    const sorted_y = R.sort(R.subtract, y);

    const [xMin, xMax] = [
        R.head(sorted_x) || 0,
        R.nth(sorted_x.length - 1, sorted_x) || 0,
    ];
    const [yMin, yMax] = [
        R.head(sorted_y) || 0,
        R.nth(sorted_y.length - 1, sorted_y) || 0,
    ];

    const xCenter = (xMax + xMin) / 2;
    const yCenter = (yMax + yMin) / 2;

    const maxDiff =
        Math.max(Math.abs(xMax - xCenter), Math.abs(yMax - yCenter)) * 1.5;
    const aspectRatio = 1;
    camera.left = xCenter - maxDiff;
    camera.right = xCenter + maxDiff;
    camera.top = yCenter + maxDiff / aspectRatio;
    camera.bottom = yCenter - maxDiff / aspectRatio;

    camera.updateProjectionMatrix();

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute(
        'size',
        new THREE.Float32BufferAttribute(sizes, 1).setUsage(
            THREE.DynamicDrawUsage
        )
    );

    const points = new THREE.Points(geometry, material);
    // const points = new THREE.Points(geometry);
    scene.add(points);
};

export const Viewer: React.FC<ViewerProps> = (props: ViewerProps) => {
    const dispatch = useDispatch();
    const coords = useSelector<RootState, Array<Coordinate>>(
        (root: RootState) => {
            return root.main.coords;
        }
    );
    const mount = useRef<HTMLDivElement>(null!); // nosemgrep: typescript.react.security.audit.react-no-refs.react-no-refs
    const [rendererState, setRenderer] = React.useState<THREE.Renderer>();
    const [mounted, setMounted] = React.useState<Boolean>(false);
    const [sceneState, setScene] = React.useState<THREE.Scene>();
    const [cameraState, setCamera] = React.useState<THREE.Camera>();
    const [geometryState, setGeometry] = React.useState<THREE.BufferGeometry>();
    const [materialState, setMaterial] = React.useState<THREE.Material>();

    const requestRef = useRef() as React.MutableRefObject<number>; // nosemgrep: typescript.react.security.audit.react-no-refs.react-no-refs
    const previousTimeRef = useRef(); // nosemgrep: typescript.react.security.audit.react-no-refs.react-no-refs

    const animate = (time) => {
        if (previousTimeRef.current !== undefined) {
            renderScene({
                renderer: rendererState,
                scene: sceneState,
                camera: cameraState,
            });
        }
        previousTimeRef.current = time;
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        const { renderer, scene, camera, geometry, material } = initGraphics();
        setRenderer(renderer);
        setScene(scene);
        setCamera(camera);
        setGeometry(geometry);
        setMaterial(material);

        if (!mounted) {
            mount.current.appendChild(renderer.domElement);
            setMounted(true);
        }

        if (coords.length === 0) {
            dispatch(getCoordinates(props.project, props.dataset));
        }
        if (sceneState && cameraState && geometryState) {
            intitializeDataPoints(
                sceneState,
                cameraState,
                geometryState,
                materialState,
                coords
            );
        }

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [coords]);

    return <div ref={mount} />; // nosemgrep: typescript.react.security.audit.react-no-refs.react-no-refs
};
