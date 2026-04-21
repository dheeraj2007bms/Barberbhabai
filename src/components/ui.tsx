import React from 'react';
import { cn } from '../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-zinc-900 text-white hover:bg-black disabled:bg-stone-300',
      secondary: 'bg-stone-100 text-slate-900 hover:bg-stone-200',
      outline: 'border border-stone-200 bg-transparent hover:bg-stone-50 text-slate-700',
      ghost: 'bg-transparent hover:bg-stone-100 text-stone-500',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-[10px] tracking-widest uppercase font-bold',
      md: 'px-4 py-3 text-xs tracking-widest uppercase font-bold',
      lg: 'px-6 py-4 text-xs tracking-widest uppercase font-bold',
      icon: 'p-2',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center transition-all focus:outline-none disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

export const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white border border-stone-200 p-4 transition-all', className)} {...props}>
    {children}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full border border-stone-200 bg-white px-4 py-3 text-xs uppercase tracking-wider transition-colors focus:border-zinc-900 focus:outline-none',
        className
      )}
      {...props}
    />
  )
);

export const Badge = ({ children, variant = 'default', className, ...props }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' | 'outline', className?: string, [key: string]: any }) => {
  const styles = {
    default: 'bg-stone-100 text-stone-500',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-white',
    error: 'bg-red-500 text-white',
    outline: 'border border-stone-200 text-stone-400 bg-transparent',
  };
  return (
    <span className={cn('px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em]', styles[variant], className)} {...props}>
      {children}
    </span>
  );
};
