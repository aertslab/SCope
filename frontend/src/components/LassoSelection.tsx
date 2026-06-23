import React, { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'

interface LassoSelectionProps {
    active: boolean
    onSelectionComplete: (indices: number[]) => void
    data: { X: number[] | Float32Array, Y: number[] | Float32Array, Z?: number[] | Float32Array } | null
    // The lasso overlay lives OUTSIDE the r3f <Canvas> so it stays locked to the
    // viewport. (A drei <Html> is part of the scene graph: it projects a
    // data-space point to the screen every frame, so the SVG drifted/scaled when
    // the user panned or zoomed the plot.) We still need the live camera and
    // renderer to project the drawn screen polygon back into world space, so the
    // parent hands them in lazily via this getter — read at selection time so we
    // always use the current camera state, never a stale snapshot.
    getThree: () => { camera: THREE.Camera, gl: THREE.WebGLRenderer } | null
}

export function LassoSelection({ active, onSelectionComplete, data, getThree }: LassoSelectionProps) {
    const [points, setPoints] = useState<{x: number, y: number}[]>([])
    const [isDrawing, setIsDrawing] = useState(false)
    const svgRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        if (!active) {
            setPoints([])
            setIsDrawing(false)
        }
    }, [active])

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!active) return
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        setIsDrawing(true)

        // Ensure camera matrices are up to date before we sample them on pointer-up.
        const three = getThree()
        if (three) {
            three.camera.updateMatrixWorld()
            ;(three.camera as { updateProjectionMatrix?: () => void }).updateProjectionMatrix?.()
        }

        const rect = e.currentTarget.getBoundingClientRect()
        setPoints([{ x: e.clientX - rect.left, y: e.clientY - rect.top }])
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!active || !isDrawing) return
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        const nx = e.clientX - rect.left
        const ny = e.clientY - rect.top
        // Throttle capture by a minimum distance: an unbounded point-per-event
        // path makes the polygon huge, so the point-in-polygon test (run over
        // every cell — hundreds of thousands at scale) costs seconds, and the
        // per-move array copy is O(n²). ~4px spacing keeps the lasso smooth
        // while bounding the vertex count.
        setPoints(prev => {
            const last = prev[prev.length - 1]
            if (last) {
                const dx = nx - last.x
                const dy = ny - last.y
                if (dx * dx + dy * dy < 16) return prev
            }
            return [...prev, { x: nx, y: ny }]
        })
    }

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!active || !isDrawing) return
        e.stopPropagation()
        e.currentTarget.releasePointerCapture(e.pointerId)
        setIsDrawing(false)

        const three = getThree()
        const svgRect = svgRef.current?.getBoundingClientRect()
        const canvasRect = three?.gl.domElement.getBoundingClientRect()

        if (points.length > 2 && data && three && svgRect && canvasRect) {
            const camera = three.camera
            camera.updateMatrixWorld()
            ;(camera as { updateProjectionMatrix?: () => void }).updateProjectionMatrix?.()

            // Test in SCREEN space: project each cell to the screen and check it
            // against the drawn polygon. This is "what you see is what you select"
            // for ANY camera — unlike projecting the polygon onto the Z=0 plane
            // (the old approach), which only held for a top-down 2D view and
            // selected the wrong cells once the camera was rotated in 3D.
            const w = canvasRect.width
            const h = canvasRect.height
            // The polygon points are in SVG-local pixels; convert a projected
            // cell (canvas-local pixels) into the same frame. The SVG and canvas
            // are coincident siblings so this offset is ~0, but tolerate any.
            const offsetX = canvasRect.left - svgRect.left
            const offsetY = canvasRect.top - svgRect.top

            // Polygon bounding box (screen space) for a cheap reject.
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
            for (const p of points) {
                if (p.x < minX) minX = p.x
                if (p.x > maxX) maxX = p.x
                if (p.y < minY) minY = p.y
                if (p.y > maxY) maxY = p.y
            }

            const selectedIndices: number[] = []
            const nPoints = data.X.length
            const Z = data.Z
            const v = new THREE.Vector3()

            for (let i = 0; i < nPoints; i++) {
                v.set(data.X[i], data.Y[i], Z && Z[i] ? Z[i] : 0)
                v.project(camera) // -> normalized device coords
                const sx = (v.x * 0.5 + 0.5) * w + offsetX
                const sy = (-v.y * 0.5 + 0.5) * h + offsetY

                // Bounding box check
                if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue

                // Point in polygon (ray casting), all in screen pixels.
                let inside = false
                for (let j = 0, k = points.length - 1; j < points.length; k = j++) {
                    const xi = points[j].x, yi = points[j].y
                    const xj = points[k].x, yj = points[k].y
                    const intersect = ((yi > sy) !== (yj > sy))
                        && (sx < (xj - xi) * (sy - yi) / (yj - yi) + xi)
                    if (intersect) inside = !inside
                }

                if (inside) selectedIndices.push(i)
            }

            onSelectionComplete(selectedIndices)
        }

        setPoints([])
    }

    if (!active) return null

    // Create path string
    const pathD = points.length > 0
        ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
        : ''

    return (
        // Plain DOM overlay rendered as a sibling of the <Canvas>, inside the
        // panel's position:relative container — so it is locked to the viewport
        // and does NOT move/scale when the plot is panned or zoomed. z-300 keeps
        // it above the toolbar (z-200) and controls, which otherwise created a
        // dead zone at the top where the crosshair/drawing didn't work. (Lasso
        // mode auto-ends after a draw, and Esc exits it, so covering the toolbar
        // mid-draw is fine.)
        <div
            className="absolute inset-0"
            style={{ zIndex: 300, cursor: 'crosshair', pointerEvents: 'auto' }}
        >
            <svg
                ref={svgRef}
                className="w-full h-full"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                {points.length > 0 && (
                    <path
                        d={pathD}
                        fill="rgba(0, 120, 255, 0.1)"
                        stroke="rgba(0, 120, 255, 0.8)"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                    />
                )}
            </svg>
        </div>
    )
}
