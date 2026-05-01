"use client";

interface StatCardProps {
  label: string;
  value: number;
  maxValue: number;
  icon: string;
  color: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function StatCard({ label, value, maxValue, icon, color }: StatCardProps) {
  const pct = Math.min(100, Math.round((value / maxValue) * 100));

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {label}
          </span>
        </div>
        <span className="text-sm font-bold text-white">{formatNumber(value)}</span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}
