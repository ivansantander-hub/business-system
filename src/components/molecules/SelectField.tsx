/**
 * SelectField - Label + Select combination.
 *
 * @level Molecule
 * @composition Label, Select
 */

import Label from "../atoms/Label";
import Select from "../atoms/Select";

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export default function SelectField({ label, error, options, placeholder, id, required, className = "", ...selectProps }: SelectFieldProps) {
  const fieldId = id || selectProps.name;
  return (
    <div className={className}>
      <Label htmlFor={fieldId} required={required}>{label}</Label>
      <Select id={fieldId} error={!!error} required={required} {...selectProps}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
