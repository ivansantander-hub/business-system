/**
 * FormField - Label + Input + Error combination.
 *
 * @level Molecule
 * @composition Label, Input
 * @example
 * <FormField label="Nombre" name="name" value={name} onChange={e => setName(e.target.value)} required />
 */

import Label from "../atoms/Label";
import Input from "../atoms/Input";

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export default function FormField({ label, error, icon, id, required, className = "", ...inputProps }: FormFieldProps) {
  const fieldId = id || inputProps.name;
  return (
    <div className={className}>
      <Label htmlFor={fieldId} required={required}>{label}</Label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" aria-hidden="true">
            {icon}
          </span>
        )}
        <Input
          id={fieldId}
          error={!!error}
          className={icon ? "pl-11" : ""}
          required={required}
          {...inputProps}
        />
      </div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
