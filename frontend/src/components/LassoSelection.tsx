import React, { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'

interface LassoSelectionProps {
    active: boolean
    onSelectionComplete: (indices: number[]) => void
    data: { X: number[] | Float32Array, Y: number[] | Float32Array } | null
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
            // Calculate offset between the SVG overlay and the WebGL canvas.
            // They're coincident siblings, so this is ~0, but the math tolerates
            // any offset.
            const offsetX = svgRect.left - canvasRect.left
            const offsetY = svgRect.top - canvasRect.top

            // Convert screen points to world points on Z=0 plane
            const worldPoints = points.map(p => {
                // Convert SVG point to Canvas point
                const canvasX = p.x + offsetX
                const canvasY = p.y + offsetY

                // Normalize using Canvas dimensions
                const ndcX = (canvasX / canvasRect.width) * 2 - 1
                const ndcY = -(canvasY / canvasRect.height) * 2 + 1

                // Create a ray from the camera
                const raycaster = new THREE.Raycaster()
                raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)

                // Intersect with Z=0 plane
                const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
                const target = new THREE.Vector3()
                raycaster.ray.intersectPlane(plane, target)

                // If no intersection (parallel), fallback to unproject with z=0 (mid-plane)
                if (!target) {
                    const vec = new THREE.Vector3(ndcX, ndcY, 0)
                    vec.unproject(camera)
                    return vec
                }

                return target
            })

            // Find points inside polygon
            const selectedIndices: number[] = []
            const nPoints = data.X.length

            // Optimization: Bounding box
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
            worldPoints.forEach(p => {
                minX = Math.min(minX, p.x)
                maxX = Math.max(maxX, p.x)
                minY = Math.min(minY, p.y)
                maxY = Math.max(maxY, p.y)
            })

            for (let i = 0; i < nPoints; i++) {
                const x = data.X[i]
                const y = data.Y[i]

                // Bounding box check
                if (x < minX || x > maxX || y < minY || y > maxY) continue

                // Point in polygon (Ray casting)
                let inside = false
                for (let j = 0, k = worldPoints.length - 1; j < worldPoints.length; k = j++) {
                    const xi = worldPoints[j].x, yi = worldPoints[j].y
                    const xj = worldPoints[k].x, yj = worldPoints[k].y

                    const intersect = ((yi > y) !== (yj > y))
                        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
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
