/**
 * Spinner - Loading indicator.
 *
 * @level Atom
 * @example
 * <Spinner size="md" />
 */

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-[3px]",
  lg: "w-12 h-12 border-4",
};

export default function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={`${sizeClasses[size]} border-violet-600 border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}
