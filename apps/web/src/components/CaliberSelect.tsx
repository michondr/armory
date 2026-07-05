import { useQuery } from '@tanstack/react-query';
import { cartridgesApi } from '../lib/api';
import { Select } from './ui';

/** Caliber picker backed by the user's cartridge list. Keeps the current value
 *  selectable even if it isn't in the list (legacy free-text / autosuggested). */
export function CaliberSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: cartridges } = useQuery({ queryKey: ['cartridges'], queryFn: cartridgesApi.list });
  const names = (cartridges ?? []).map((c) => c.name);
  const options = value && !names.includes(value) ? [value, ...names] : names;

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </Select>
  );
}
