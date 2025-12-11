import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

interface CameraControllerProps {
    data: { X: number[] | Float32Array, Y: number[] | Float32Array } | null
    controlsRef: any
    initialCamera?: any
}

export const CameraController = ({ data, controlsRef, initialCamera }: CameraControllerProps) => {
    const { camera, size } = useThree()
    const initializedRef = useRef(false)
    
    useEffect(() => {
        if (!data || data.X.length === 0) return
        
        // If we have an initial camera, apply it
        if (initialCamera) {
            if (!initializedRef.current && controlsRef.current) {
                 camera.position.set(initialCamera.position.x, initialCamera.position.y, initialCamera.position.z)
                 camera.zoom = initialCamera.zoom
                 camera.updateProjectionMatrix()
                 controlsRef.current.target.set(initialCamera.target.x, initialCamera.target.y, initialCamera.target.z)
                 controlsRef.current.update()
                 initializedRef.current = true
            }
            return
        }

        // Only auto-fit if we haven't initialized via session, OR if data changed significantly (not handled here for now)
        // For now, if we initialized from session, we don't auto-fit again unless data changes and we reset initializedRef (which we don't)
        // But if we didn't have initialCamera, we auto-fit.
        if (initialCamera && initializedRef.current) return; 

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for(let i=0; i<data.X.length; i++) {
            if (data.X[i] < minX) minX = data.X[i]
            if (data.X[i] > maxX) maxX = data.X[i]
            if (data.Y[i] < minY) minY = data.Y[i]
            if (data.Y[i] > maxY) maxY = data.Y[i]
        }
        
        const width = maxX - minX
        const height = maxY - minY
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        
        const padding = 1.1
        const zoomX = size.width / (width * padding)
        const zoomY = size.height / (height * padding)
        // Ensure we don't zoom in too much if data is tiny, or zoom out too much
        const newZoom = Math.min(zoomX, zoomY)
        
        // Update camera
        camera.zoom = newZoom
        camera.position.set(cx, cy, 100)
        camera.updateProjectionMatrix()
        
        // Update controls target
        if (controlsRef.current) {
            controlsRef.current.target.set(cx, cy, 0)
            controlsRef.current.update()
        }
        
    }, [data, size, camera, controlsRef, initialCamera])
    
    return null
}
