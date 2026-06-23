import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

interface CameraControllerProps {
    data: { X: number[] | Float32Array, Y: number[] | Float32Array } | null
    controlsRef: any
    initialCamera?: any
    /** Open an auto-fit in 3D at an angle (instead of straight top-down) so the
     *  third dimension's depth is immediately visible. */
    tilt?: boolean
    /** Identifies WHAT is plotted (embedding + dims + 2D/3D). The camera re-fits
     *  only when this changes — never on a stray refetch of the same plot or a
     *  resize, so a restored / user-adjusted camera is preserved. */
    fitKey?: string
}

export const CameraController = ({ data, controlsRef, initialCamera, tilt, fitKey }: CameraControllerProps) => {
    const { camera, size } = useThree()
    const initializedRef = useRef(false)
    // The plot identity last fitted to. Re-fit only when this changes (a real
    // embedding/dimension/mode switch), not when `data` merely gets a new
    // reference from a re-fetch of the SAME plot.
    const prevFitKeyRef = useRef<string | undefined>(undefined)

    useEffect(() => {
        if (!data || data.X.length === 0) return

        // Restore a saved camera on the FIRST data load. Wait for OrbitControls
        // to mount so target/zoom apply cleanly; until then leave `initialized`
        // false and retry on the next run. A restored camera is what lets a
        // shared link stay focused on the region the author was looking at — and
        // it is authoritative: only an explicit plot change (fitKey) re-fits.
        if (initialCamera && !initializedRef.current) {
            if (!controlsRef.current) return
            camera.position.set(initialCamera.position.x, initialCamera.position.y, initialCamera.position.z)
            camera.zoom = initialCamera.zoom
            camera.updateProjectionMatrix()
            controlsRef.current.target.set(initialCamera.target.x, initialCamera.target.y, initialCamera.target.z)
            controlsRef.current.update()
            initializedRef.current = true
            prevFitKeyRef.current = fitKey
            return
        }

        const firstFit = !initializedRef.current
        const fitChanged = prevFitKeyRef.current !== fitKey
        prevFitKeyRef.current = fitKey
        initializedRef.current = true

        // After the first fit, ONLY re-fit when the plotted embedding/dims/mode
        // actually changed. A resize, or a re-fetch of the same plot, must NOT
        // clobber the camera the user panned/zoomed to (or one restored from a
        // shared link) — the orthographic projection adapts to aspect on its own.
        if (!firstFit && !fitChanged) return

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

        // Update camera. In 3D, open at an angle (orbit ~34° off top-down toward
        // -Y) so depth reads immediately; in 2D, look straight down the Z axis.
        camera.zoom = newZoom
        if (tilt) {
            camera.position.set(cx, cy - 55, 83)
        } else {
            camera.position.set(cx, cy, 100)
        }
        camera.updateProjectionMatrix()

        // Update controls target
        if (controlsRef.current) {
            controlsRef.current.target.set(cx, cy, 0)
            controlsRef.current.update()
        }

    }, [data, size, camera, controlsRef, initialCamera, tilt, fitKey])
    
    return null
}
