import { useState, ReactNode } from 'react';

interface DropZoneProps {
    children: ReactNode;
    onDrop: (e: React.DragEvent) => void;
    className?: string;
    dragType?: 'view' | 'dataset' | null;
}

type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export function DropZone({ children, onDrop, className = '', dragType }: DropZoneProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [dropPosition, setDropPosition] = useState<DropPosition>('center');

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        
        if (!isDragOver) setIsDragOver(true);

        // Calculate drop position if dragging a view
        if (dragType === 'view') {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const width = rect.width;
            const height = rect.height;

            if (x > width * 0.75) setDropPosition('right');
            else if (x < width * 0.25) setDropPosition('left');
            else if (y > height * 0.75) setDropPosition('bottom');
            else if (y < height * 0.25) setDropPosition('top');
            else setDropPosition('center'); // Should not happen with current logic but good fallback
        } else {
            setDropPosition('center');
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setDropPosition('center');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setDropPosition('center');
        onDrop(e);
    };

    const getOverlayStyle = () => {
        const base = "absolute z-50 bg-blue-500/30 border-4 border-blue-500 border-dashed flex items-center justify-center pointer-events-none transition-all duration-100";
        
        switch (dropPosition) {
            case 'left': return `${base} top-0 left-0 bottom-0 w-1/2`;
            case 'right': return `${base} top-0 right-0 bottom-0 w-1/2`;
            case 'top': return `${base} top-0 left-0 right-0 h-1/2`;
            case 'bottom': return `${base} bottom-0 left-0 right-0 h-1/2`;
            default: return `${base} inset-0`;
        }
    };

    return (
        <div 
            className={`relative h-full w-full ${className}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Visual Overlay for Drag Over */}
            {isDragOver && (
                <div className={getOverlayStyle()}>
                    <div className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-lg">
                        {dragType === 'view' ? 'Split View' : 'Drop Here'}
                    </div>
                </div>
            )}
            {children}
        </div>
    );
}
