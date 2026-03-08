/**
 * Textarea - Multi-line text input.
 *
 * @level Atom
 * @example
 * <Textarea rows={3} placeholder="Notas…" />
 */

import { forwardRef } from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`input-field resize-y ${error ? "border-red-500" : ""} ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
export default Textarea;
