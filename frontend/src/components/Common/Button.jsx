import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2';

  const variants = {
    primary: 'bg-orange-600 hover:bg-orange-700 text-white disabled:bg-neutral-400',
    secondary: 'bg-neutral-200 hover:bg-neutral-300 text-neutral-900 disabled:bg-neutral-100',
    outline: 'border border-neutral-300 hover:bg-neutral-50 text-neutral-900 disabled:bg-neutral-50',
    ghost: 'hover:bg-neutral-100 text-neutral-700 disabled:text-neutral-400',
    danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-neutral-400',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className} ${
        isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;