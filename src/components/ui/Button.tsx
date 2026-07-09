import React from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white active:bg-primary-dark',
  secondary: 'bg-black/5 text-ink active:bg-black/10',
  ghost: 'bg-transparent text-primary active:bg-primary/10',
  danger: 'bg-risk text-white active:bg-risk/90',
};

const SIZES: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-[15px]',
  lg: 'px-5 py-3.5 text-base font-semibold',
};

/** 主/次按钮（橙色主、灰次）。 */
export function Button({
  variant = 'primary',
  className,
  children,
  onClick,
  disabled,
  fullWidth,
  size = 'md',
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'rounded-full transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  );
}
