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
    // Tracks the data (embedding) reference last fitted, so we can tell a real
    // embedding switch apart from a mere viewport resize.
    const prevDataRef = useRef<typeof data>(null)

    useEffect(() => {
        if (!data || data.X.length === 0) return

        // Restore a saved camera on the FIRST data load. Wait for OrbitControls
        // to mount so target/zoom apply cleanly; until then leave `initialized`
        // false and retry on the next run. A restored camera is what lets a
        // shared link stay focused on the region the author was looking at.
        if (initialCamera && !initializedRef.current) {
            if (!controlsRef.current) return
            camera.position.set(initialCamera.position.x, initialCamera.position.y, initialCamera.position.z)
            camera.zoom = initialCamera.zoom
            camera.updateProjectionMatrix()
            controlsRef.current.target.set(initialCamera.target.x, initialCamera.target.y, initialCamera.target.z)
            controlsRef.current.update()
            initializedRef.current = true
            prevDataRef.current = data
            return
        }

        // Distinguish a genuine embedding change (new `data` array) from a mere
        // viewport resize (`size` dep changed but `data` is the same object).
        const dataChanged = prevDataRef.current !== data
        const firstFit = !initializedRef.current
        prevDataRef.current = data
        initializedRef.current = true

        // After the first fit, ONLY re-fit when the embedding actually changed.
        // A resize must NOT clobber the camera the user panned/zoomed to (or one
        // restored from a shared link) — the orthographic projection already
        // adapts to the new aspect on its own.
        if (!firstFit && !dataChanged) return

        // Auto-fit to the current data bounds, ignoring NaN/Inf coordinates
        // (some embeddings leave a subset of cells unpositioned). Bounds built
        // from NaN would yield a NaN zoom and break the whole view.
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (let i = 0; i < data.X.length; i++) {
            const x = data.X[i], y = data.Y[i]
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
        }
        // No finite points (all NaN) — nothing sensible to fit to.
        if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
            return
        }

        const width = (maxX - minX) || 1
        const height = (maxY - minY) || 1
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
