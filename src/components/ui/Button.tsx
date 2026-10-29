import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const Button = ({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) => {
  const variantClass = variant === 'ghost' ? 'btn-ghost' : `aurora-btn aurora-btn-${variant}`;
  return <button type={type} className={`${variantClass}${className ? ` ${className}` : ''}`} {...props} />;
};

export default Button;
