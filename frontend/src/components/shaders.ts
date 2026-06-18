import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";

export const PointMaterial = shaderMaterial(
  {
    effectFactor: 1.2,
    dispFactor: 0,
    pointTexture: null,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    transparent: true,
    vertexColors: true,
    shape: 0,
  },
  ` attribute float size;
    attribute float opacity;
    varying vec3 vColor;
    varying float vOpacity;
    void main() {
        vColor = color;
        vOpacity = opacity;
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_PointSize = size;
        gl_Position = projectionMatrix * mvPosition;
    }`,
  ` uniform sampler2D pointTexture;
    uniform int shape;
    varying vec3 vColor;
    varying float vOpacity;
    
  void main(){
    // Cells hidden by the active filter are sent through at ~0 opacity — drop
    // them entirely so they write neither colour nor depth.
    if (vOpacity < 0.01) discard;

    vec2 uv = gl_PointCoord - 0.5;
    bool discardPixel = false;

    if (shape == 0) { // Circle
        if (dot(uv, uv) > 0.25) discardPixel = true;
    } else if (shape == 1) { // Square
        // Keep all
    } else if (shape == 2) { // Hexagon Flat
        vec2 q = abs(uv);
        if (max(q.y, q.x * 0.866025 + q.y * 0.5) > 0.4330127) discardPixel = true;
    } else if (shape == 3) { // Hexagon Pointy
        vec2 q = abs(uv);
        if (max(q.x, q.y * 0.866025 + q.x * 0.5) > 0.4330127) discardPixel = true;
    }

    if (discardPixel)
        discard;
    else
        gl_FragColor = vec4(vColor, vOpacity);
    }`
);


