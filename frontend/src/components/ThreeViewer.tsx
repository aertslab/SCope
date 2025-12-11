import * as THREE from "three"
import { extend, Object3DNode } from "@react-three/fiber"
import { PointMaterial } from "./shaders"
import { useTexture } from "@react-three/drei"
import { useMemo } from "react"

// Extend Three.js with custom materials
extend({ PointMaterial })

// Add types for the custom materials
declare module "@react-three/fiber" {
  interface ThreeElements {
    pointMaterial: Object3DNode<THREE.ShaderMaterial, typeof PointMaterial> & { pointTexture?: THREE.Texture; dispFactor?: number; shape?: number }
  }
}

import { Selection } from "../types"

function SelectionPoints({ selection, data, size, texture, shape }: { selection: Selection, data: { X: number[] | Float32Array, Y: number[] | Float32Array, Z: number[] | Float32Array }, size: number | number[], texture: THREE.Texture, shape: number }) {
    const baseSize = typeof size === 'number' ? size : (Array.isArray(size) ? size[0] : 5)
    
    const geometry = useMemo(() => {
        const positions = new Float32Array(selection.indices.length * 3)
        const sizes = new Float32Array(selection.indices.length)
        const opacities = new Float32Array(selection.indices.length).fill(1.0)
        const colors = new Float32Array(selection.indices.length * 3)
        const c = new THREE.Color(selection.color)
        
        selection.indices.forEach((idx, i) => {
            positions[i*3] = data.X[idx]
            positions[i*3+1] = data.Y[idx]
            positions[i*3+2] = (data.Z && data.Z[idx] ? data.Z[idx] : 0) - 0.05
            sizes[i] = baseSize * 1.5
            colors[i*3] = c.r
            colors[i*3+1] = c.g
            colors[i*3+2] = c.b
        })
        
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
        geo.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1))
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        return geo
    }, [selection, data, baseSize])

    return (
        <points geometry={geometry}>
            <pointMaterial
                pointTexture={texture}
                transparent={true}
                depthTest={true}
                shape={shape}
            />
        </points>
    )
}

export function ThreeViewer(props: {
  data: { X: Array<number> | Float32Array; Y: Array<number> | Float32Array; Z: Array<number> | Float32Array }
  colours: any
  customColors?: Float32Array | null
  size: number | Array<number>
  opacities?: number | Array<number>
  shader?: string
  shape?: number
  selections?: Selection[]
  colorRanges?: Record<string, [number, number]>
}) {
  const texture1 = useTexture("/images/real_dot.png")

  const { data, colours: propColours, customColors, size, opacities, selections, colorRanges } = props
  
  // 0: Circle, 1: Square, 2: Hexagon Flat, 3: Hexagon Pointy
  const shape = props.shape !== undefined ? props.shape : (props.shader === 'square' ? 1 : 0)

  const { positions, colors, sizeArr, opacityArr } = useMemo(() => {
      const count = data.X.length
      const positions = new Float32Array(count * 3)
      
      // Fill positions
      for(let i=0; i<count; i++) {
          positions[i*3] = data.X[i] || 0
          positions[i*3+1] = data.Y[i] || 0
          positions[i*3+2] = (data.Z && data.Z[i]) ? data.Z[i] : 0
      }

      // Initialize colors
      let colors: Float32Array

      if (customColors) {
          colors = customColors
      } else if (Object.keys(propColours).length > 0) {
        colors = new Float32Array(count * 3)
        // Initialize with dark grey (0.1) to show unexpressed cells
        colors.fill(0.1)
        
        for (const key in propColours) {
          const colData = propColours[key]
          if (!colData || colData.length === 0) continue
          
          // Find min/max for normalization
          let min = Infinity, max = -Infinity
          
          if (colorRanges && colorRanges[key]) {
              [min, max] = colorRanges[key]
          } else {
              for(let i=0; i<colData.length; i++) {
                  if(colData[i] < min) min = colData[i]
                  if(colData[i] > max) max = colData[i]
              }
          }
          
          const range = max - min || 1
          
          // Add color contribution
          // Slot 0: Red, Slot 1: Green, Slot 2: Blue
          const slot = parseInt(key)
          if (slot >= 0 && slot < 3) {
              for(let i=0; i<count; i++) {
                  let val = colData[i]
                  
                  // Clipping
                  if (val < min) val = min
                  if (val > max) val = max

                  const normalized = (val - min) / range
                  colors[i*3 + slot] += normalized
              }
          }
        }
      } else {
          // Default grey
          colors = new Float32Array(count * 3)
          for(let i=0; i<count; i++) {
              colors[i*3] = 0.1
              colors[i*3+1] = 0.1
              colors[i*3+2] = 0.1
          }
      }

      // Handle sizes
      let sizeArr: Float32Array
      if (Array.isArray(size)) {
          sizeArr = new Float32Array(size)
      } else {
          sizeArr = new Float32Array(count).fill(size)
      }

      // Handle opacities
      let opacityArr: Float32Array
      if (Array.isArray(opacities)) {
          opacityArr = new Float32Array(opacities)
      } else {
          opacityArr = new Float32Array(count).fill(opacities || 1.0)
      }

      return { positions, colors, sizeArr, opacityArr }
  }, [data, propColours, customColors, size, opacities, colorRanges])

  const geometry = useMemo(() => {
      const bg = new THREE.BufferGeometry()
      bg.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
      bg.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
      bg.setAttribute("size", new THREE.Float32BufferAttribute(sizeArr, 1).setUsage(THREE.DynamicDrawUsage))
      bg.setAttribute("opacity", new THREE.Float32BufferAttribute(opacityArr, 1).setUsage(THREE.DynamicDrawUsage))
      bg.computeBoundingBox()
      return bg
  }, [positions, colors, sizeArr, opacityArr])

  return (
    <group>
      <points geometry={geometry}>
        <pointMaterial
          extensions={{
            derivatives: true,
            fragDepth: false,
            drawBuffers: false,
            shaderTextureLOD: false,
            clipCullDistance: false,
            multiDraw: false
          }}
          pointTexture={texture1}
          blending={THREE.NormalBlending}
          depthTest={true}
          dispFactor={-1}
          shape={shape}
        />
      </points>
      {selections?.map((selection) => {
          if (!selection.visible) return null
          return (
              <SelectionPoints 
                  key={selection.id} 
                  selection={selection} 
                  data={data} 
                  size={size}
                  texture={texture1}
                  shape={shape}
              />
          )
      })}
    </group>
  )
}
