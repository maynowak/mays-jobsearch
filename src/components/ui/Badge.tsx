import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'soon' | 'active';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const Badge = ({ tone = 'neutral', className = '', ...props }: BadgeProps) => (
  <span className={`ui-badge ui-badge-${tone}${className ? ` ${className}` : ''}`} {...props} />
);

export default Badge;
