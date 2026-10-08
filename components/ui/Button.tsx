import React from 'react';
// ─── Button UI Component ──────────────────────────────────────────────────────
// Variants: filled (brass), outline, ghost, liquid (gold wave fill on hover).
// Focus ring remains visible in both light and dark themes via :focus-visible.

import { type ButtonHTMLAttributes, type AnchorHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'filled' | 'outline' | 'ghost' | 'liquid';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}

type ButtonAsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button'; href?: undefined };

type ButtonAsAnchor = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a'; href: string };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm gap-1.5',
  md: 'px-6 py-3 text-base gap-2',
  lg: 'px-8 py-4 text-md gap-2.5',
};

const variantClasses: Record<ButtonVariant, string> = {
  filled: [
    'bg-accent text-[hsl(35,43%,88%)]',
    'hover:brightness-110 active:brightness-95',
    'shadow-[0_2px_12px_rgba(52,38,12,0.28)]',
    'hover:shadow-[0_4px_24px_rgba(52,38,12,0.38)]',
  ].join(' '),
  outline: [
    'border border-accent text-accent',
    'hover:bg-accent/10',
    'active:bg-accent/20',
  ].join(' '),
  liquid: 'btn-liquid',
  ghost: [
    'text-text hover:text-accent',
    'hover:bg-accent/8',
    'active:bg-accent/15',
  ].join(' '),
};

const baseClasses = [
  'inline-flex items-center justify-center',
  'font-body font-medium',
  'rounded-full',
  'cursor-pointer select-none',
  'no-underline',
  'whitespace-nowrap',
].join(' ');

export function Button(props: ButtonProps): React.ReactElement {
  const { variant = 'filled', size = 'md', children, className, as, ...rest } = props;

  const isLiquid = variant === 'liquid';
  const classes = clsx(
    baseClasses,
    isLiquid ? null : 'transition-all duration-200',
    sizeClasses[size],
    variantClasses[variant],
    className,
  );
  const content = isLiquid ? (
    <>
      <span className="btn-liquid__fill" aria-hidden="true" />
      <span className="btn-liquid__label">{children}</span>
      <span className="btn-liquid__label btn-liquid__label--ink" aria-hidden="true">{children}</span>
    </>
  ) : (
    children
  );

  if (as === 'a') {
    const { href, ...anchorRest } = rest as ButtonAsAnchor;
    return (
      <a href={href} className={classes} {...anchorRest}>
        {content}
      </a>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}
