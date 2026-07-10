import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose?: () => void;
  children: React.ReactNode;
  /** 是否允许点击遮罩关闭（默认允许；危机等强制弹窗可设为 false） */
  dismissable?: boolean;
}

/** 弹窗壳（移动端底部抽屉式 + 桌面居中）。
 *  通过 createPortal 渲染到 document.body，并在打开时锁定 <body> 背景滚动，
 *  修复移动端（尤其 iOS Safari）页面滚动时 fixed 弹窗漂移的问题。
 */
export function Modal({ open, title, onClose, children, dismissable = true }: ModalProps) {
  // 打开时锁定背景滚动；卸载/关闭时恢复。SSR/测试环境（无 document）做空值守卫。
  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const content = (
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

  // SSR / 测试环境无 document.body 时直接渲染（避免 portal 崩溃）
  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
