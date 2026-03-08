/**
 * Input - Text input field.
 *
 * @level Atom
 * @example
 * <Input placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
 */

import { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`input-field ${error ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" : ""} ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
export default Input;
