import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
const cx = (...v: (string | undefined)[]) => v.filter(Boolean).join(' ');
export function Button(p: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={cx('wyn-button', p.className)} />;
}
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx('wyn-input', p.className)} />;
}
export function Card(p: HTMLAttributes<HTMLElement>) {
  return <section {...p} className={cx('wyn-card', p.className)} />;
}
export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      className="wyn-dialog-backdrop"
      onMouseDown={() => onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="wyn-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title">{title}</h2>
        {children}
        <Button onClick={() => onClose()}>Close</Button>
      </section>
    </div>
  );
}
export function Skeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="wyn-skeleton" role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <section className="wyn-state">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </section>
  );
}
export function ErrorState({
  title = 'Something went wrong',
}: {
  title?: string;
}) {
  return (
    <section role="alert" className="wyn-state">
      <h2>{title}</h2>
    </section>
  );
}
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="wyn-spinner" role="status" aria-label={label} />;
}
