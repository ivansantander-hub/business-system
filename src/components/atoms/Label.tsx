/**
 * Label - Form label element.
 *
 * @level Atom
 * @example
 * <Label htmlFor="email">Correo electrónico</Label>
 */

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export default function Label({ children, required, className = "", ...props }: LabelProps) {
  return (
    <label className={`block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ${className}`} {...props}>
      {children}
      {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}
