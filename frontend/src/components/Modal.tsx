import { X } from 'lucide-react'
import { ReactNode } from 'react'

type ModalSize = 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: ReactNode
    /** Max width of the modal. Defaults to 'md' to preserve existing modals. */
    size?: ModalSize
}

const SIZE_CLASSES: Record<ModalSize, string> = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            {/* max-h-[90vh] + overflow-y-auto guarantees tall content (e.g. the
                upload form with the API instructions expanded) scrolls inside
                the modal instead of dropping off the bottom of the viewport. */}
            <div className={`bg-white rounded-lg shadow-xl p-6 w-full ${SIZE_CLASSES[size]} relative max-h-[90vh] overflow-y-auto`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>

                {children}
            </div>
        </div>
    )
}
