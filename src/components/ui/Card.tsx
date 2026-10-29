import type { HTMLAttributes } from 'react';

export type CardVariant = 'default' | 'primary' | 'features';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const Card = ({ variant = 'default', className = '', ...props }: CardProps) => (
  <div
    className={`aurora-card${variant === 'primary' ? ' aurora-card-primary' : ''}${variant === 'features' ? ' aurora-card--features' : ''}${className ? ` ${className}` : ''}`}
    {...props}
  />
);

export default Card;
