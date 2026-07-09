import React from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

/** 圆角卡片容器（暖白背景、轻阴影）。 */
export function Card({ className, children, onClick }: CardProps) {
  return (
    <div
      className={clsx('bg-card rounded-card shadow-card border border-black/5', className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
