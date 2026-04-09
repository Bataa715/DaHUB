const CFG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  critical: { label: 'Маш өндөр', dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
  high: { label: 'Өндөр', dot: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  medium: { label: 'Дунд', dot: 'bg-amber-400', bg: 'bg-amber-400/10', text: 'text-amber-400' },
  low: { label: 'Бага', dot: 'bg-sky-400', bg: 'bg-sky-400/10', text: 'text-sky-400' },
};

export default function SeverityBadge({ severity, size = 'sm' }: { severity: string; size?: 'sm' | 'md' }) {
  const c = CFG[severity] || CFG.low;
  const sz = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-semibold ${c.bg} ${c.text} ${sz}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export { CFG as SEVERITY_CONFIG };
