/**
 * StatCard - Dashboard metric display card.
 *
 * @level Molecule
 * @example
 * <StatCard label="Ventas Hoy" value="$1,200,000" icon={<DollarSign />} gradient="from-emerald-500 to-emerald-600" accent />
 */

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient?: string;
  accent?: boolean;
}

export default function StatCard({ label, value, icon, gradient = "from-violet-500 to-indigo-600", accent }: StatCardProps) {
  if (accent) {
    return (
      <div className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${gradient} shadow-glow-sm`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-[13px] font-medium text-white/80">{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</p>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/20">
            {icon}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-muted">{label}</p>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
            {value}
          </p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} shadow-sm`}>
          <span className="text-white">{icon}</span>
        </div>
      </div>
    </div>
  );
}
