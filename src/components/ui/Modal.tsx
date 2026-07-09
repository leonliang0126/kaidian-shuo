import React from 'react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose?: () => void;
  children: React.ReactNode;
  /** 是否允许点击遮罩关闭（默认允许；危机等强制弹窗可设为 false） */
  dismissable?: boolean;
}

/** 弹窗壳（移动端底部抽屉式 + 桌面居中）。 */
export function Modal({ open, title, onClose, children, dismissable = true }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={() => {
        if (dismissable && onClose) onClose();
      }}
    >
      <div
        className={clsx(
          'w-full max-w-[480px] bg-card rounded-t-card shadow-card max-h-[88vh] overflow-y-auto no-scrollbar',
          'sm:rounded-card',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 bg-card px-5 pt-4 pb-2 border-b border-black/5">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
