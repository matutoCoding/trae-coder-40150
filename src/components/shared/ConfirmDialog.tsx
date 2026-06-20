import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * ConfirmDialog 通用二次确认弹窗组件属性
 */
export interface ConfirmDialogProps {
  /** 弹窗是否打开 */
  open: boolean;
  /** 关闭弹窗回调（点击取消、遮罩或 ESC 键时触发） */
  onClose: () => void;
  /** 点击确认按钮的回调 */
  onConfirm: () => void;
  /** 弹窗标题，默认"确认操作" */
  title?: string;
  /** 提示消息，默认"确定要执行该操作吗？" */
  message?: string;
  /** 确认按钮文本，默认"确认" */
  confirmText?: string;
  /** 取消按钮文本，默认"取消" */
  cancelText?: string;
  /** 是否为危险操作（确认按钮使用 danger 变体样式），默认 false */
  danger?: boolean;
  /** 确认按钮是否显示加载状态，默认 false */
  loading?: boolean;
  /** 外层容器自定义类名 */
  className?: string;
  /** 弹窗最大宽度，默认 sm */
  maxWidth?: 'sm' | 'md' | 'lg';
}

/**
 * 通用二次确认弹窗组件
 * 用于删除、提交、升降级等需要二次确认的操作场景
 * 支持危险操作样式、加载状态、自定义文本
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = '确认操作',
  message = '确定要执行该操作吗？',
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  loading = false,
  className,
  maxWidth = 'sm',
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      className={cn(className)}
      title={
        <div className="flex items-center gap-2">
          {danger && (
            <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-red-50 text-danger">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </span>
          )}
          <span>{title}</span>
        </div>
      }
      footer={
        <>
          {/* 取消按钮 */}
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          {/* 确认按钮 */}
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {/* 提示消息内容 */}
      <div className="text-sm text-ink-600 leading-relaxed whitespace-pre-wrap">
        {message}
      </div>
    </Modal>
  );
}
