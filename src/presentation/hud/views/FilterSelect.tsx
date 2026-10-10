interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** [value, label] pairs. */
  options: [string, string][];
}

export function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-fog">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring w-full min-w-0 rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 text-xs text-snow"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
