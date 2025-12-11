import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export const Card = ({ children, className = '' }: CardProps) => {
    return (
        <div className={`bg-white overflow-hidden shadow rounded-lg border border-gray-200 ${className}`}>
            {children}
        </div>
    );
};

export const CardHeader = ({ children, className = '' }: CardProps) => {
    return (
        <div className={`px-4 py-5 sm:px-6 border-b border-gray-200 ${className}`}>
            {children}
        </div>
    );
};

export const CardTitle = ({ children, className = '' }: CardProps) => {
    return (
        <h3 className={`text-lg leading-6 font-medium text-gray-900 ${className}`}>
            {children}
        </h3>
    );
};

export const CardContent = ({ children, className = '' }: CardProps) => {
    return (
        <div className={`px-4 py-5 sm:p-6 ${className}`}>
            {children}
        </div>
    );
};

export const CardFooter = ({ children, className = '' }: CardProps) => {
    return (
        <div className={`px-4 py-4 sm:px-6 bg-gray-50 border-t border-gray-200 ${className}`}>
            {children}
        </div>
    );
};
