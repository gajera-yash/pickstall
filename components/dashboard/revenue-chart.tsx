import { formatMoney } from "@/lib/products/money";

/**
 * Revenue per day as bars (server-rendered SVG, no chart library). A data table sits under it for
 * screen readers, so the numbers are never only in the picture. An empty period is a flat baseline,
 * not an invented curve.
 */
export function RevenueChart({ days, revenueCents, currency }: { days: string[]; revenueCents: number[]; currency: string }) {
  const max = Math.max(...revenueCents, 0);
  const width = 600;
  const height = 160;
  const gap = days.length > 45 ? 1 : 3;
  const barWidth = Math.max(2, (width - gap * (days.length - 1)) / days.length);

  return (
    <figure className="flex flex-col gap-2">
      <svg role="img" aria-label={`Revenue per day, ${formatMoney(revenueCents.reduce((a, b) => a + b, 0), currency)} in total`} viewBox={`0 0 ${width} ${height + 4}`} preserveAspectRatio="none" className="h-40 w-full text-blue">
        <line x1="0" x2={width} y1={height + 1} y2={height + 1} stroke="var(--line)" strokeWidth="2" />
        {revenueCents.map((cents, index) => {
          const barHeight = max === 0 ? 0 : Math.max(2, (cents / max) * (height - 8));
          return cents === 0 ? null : <rect key={days[index]} x={index * (barWidth + gap)} y={height - barHeight} width={barWidth} height={barHeight} rx="2" fill="currentColor" opacity="0.85" />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-mute">
        <span>{days[0]}</span>
        <span>{days.at(-1)}</span>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>Revenue by day</caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day, index) => (
              <tr key={day}>
                <td>{day}</td>
                <td>{formatMoney(revenueCents[index] ?? 0, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
