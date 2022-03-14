import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useDispatch, useSelector } from 'react-redux';
import { Coordinate } from '../../api';
import { RootState } from '../../redux/reducers';
import { getCoordinates } from '../../redux/actions';
import { render } from '@testing-library/react';
import * as R from 'ramda'

export type ViewerProps = {
    dataset: number;
};

const initGraphics = () => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-250, 250, -250, 250)
    camera.position.set(0, 0, 2000)
    camera.lookAt(new THREE.Vector3(0, 0, 0))
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(500, 500);
    const texture = new THREE.TextureLoader().load('src/images/dot.png');
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
        size: 5,
        vertexColors: true,
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.NoBlending,
    });
    const controls = new OrbitControls(
        camera,
        renderer.domElement
    );
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: null,
        RIGHT: null,
    };
    controls.enableRotate = false;

    const result = {
        renderer,
        scene,
        camera,
        geometry,
    };

    controls.addEventListener('change', () => renderScene(result));

    return result;
};

const renderScene = ({ renderer, scene, camera }) => {
    renderer.render(scene, camera);
}


const intitializeDataPoints = (scene, camera, geometry, coords) => {
    const x = [] as any;
    const y = [] as any;
    const positions = [] as any;
    const colors = [] as any;

    coords.forEach((coord: { x: number; y: number; }) => {
        x.push(coord.x);
        y.push(coord.y);
        positions.push(coord.x, coord.y, 0);
        colors.push(0, 0, 0);

    })

    scene.clear();

    const sorted_x = R.sort(x)
    const sorted_y = R.sort(y)

    const xMax = sorted_x[sorted_x.length - 1]
    const xMin = sorted_x[0]
    const yMax = sorted_y[sorted_y.length - 1]
    const yMin = sorted_y[0]

    const xCenter = (xMax - xMin) / 2
    const yCenter = (yMax - yMin) / 2

    const maxDiff =
        Math.max(Math.abs(xMax - xCenter), Math.abs(yMax - yCenter)) * 1.5;
    const aspectRatio = 1
    camera.left = xCenter - maxDiff;
    camera.right = xCenter + maxDiff;
    camera.top = yCenter + maxDiff / aspectRatio;
    camera.bottom = yCenter - maxDiff / aspectRatio;
    camera.updateProjectionMatrix();

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colors, 3)
    );

    // const points = new THREE.Points(this.geometry, this.material);
    const points = new THREE.Points(geometry);
    scene.add(points);
}

export const Viewer: React.FC<ViewerProps> = (props: ViewerProps) => {
    const dispatch = useDispatch();
    const coords = useSelector<RootState, Array<Coordinate>>((root: RootState) => {
        return root.main.coords;
    });
    const mount = useRef<HTMLDivElement>(null!)
    const [count, setCount] = React.useState(0)
    const [rendererState, setRenderer] = React.useState()
    const [sceneState, setScene] = React.useState()
    const [cameraState, setCamera] = React.useState()
    const [geometryState, setGeometry] = React.useState()

    const requestRef = React.useRef() as React.MutableRefObject<number>;
    const previousTimeRef = React.useRef();

    const animate = time => {
        if (previousTimeRef.current != undefined) {
            const deltaTime = time - previousTimeRef.current;

            // Pass on a function to the setter of the state
            // to make sure we always have the latest state
            setCount(prevCount => (prevCount + deltaTime * 0.01) % 100);
            renderScene({ renderer: rendererState, scene: sceneState, camera: cameraState });
        }
        previousTimeRef.current = time;
        requestRef.current = requestAnimationFrame(animate);
    }

    useEffect(() => {
        if (coords.length === 0) {
            dispatch(getCoordinates(`${props.dataset}`));

            const {
                renderer,
                scene,
                camera,
                geometry,
            } = initGraphics();
            setRenderer(renderer);
            setScene(scene);
            setCamera(camera);
            setGeometry(geometry);
            mount.current.appendChild(renderer.domElement);
        }
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    })

    return (<div
        ref={mount}
    />)
}