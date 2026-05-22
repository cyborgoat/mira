import type { ReactNode, CSSProperties } from 'react';

interface MiraCardProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  extra?: ReactNode;
}

export function MiraCard({ title, children, className = '', style, extra }: MiraCardProps) {
  return (
    <div className={`mira-card ${className}`} style={style}>
      {(title || extra) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {title && <div className="mira-card-title">{title}</div>}
          {extra}
        </div>
      )}
      {children}
    </div>
  );
}
