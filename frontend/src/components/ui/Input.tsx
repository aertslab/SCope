import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, helperText, id, ...props }, ref) => {
        const inputId = id || props.name;

        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
                        {label}
                    </label>
                )}
                <input
                    id={inputId}
                    ref={ref}
                    className={`
                        block w-full rounded-md border border-gray-400 shadow-sm 
                        py-2 px-3
                        focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm 
                        disabled:bg-gray-50 disabled:text-gray-500
                        ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                        ${className}
                    `}
                    {...props}
                />
                {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
                {helperText && !error && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
            </div>
        );
    }
);

Input.displayName = "Input";
