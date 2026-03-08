/**
 * Badge - Status indicator label.
 *
 * @level Atom
 * @example
 * <Badge variant="success">Activo</Badge>
 */

export type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "badge-success",
  danger: "badge-danger",
  warning: "badge-warning",
  info: "badge-info",
  neutral: "badge-neutral",
};

export default function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span className={`${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
