/**
 * A small bar chart for the admin pages (D-116): server-rendered SVG, no chart library, with the
 * numbers in a table for screen readers. Each bar has a native tooltip with its label and value.
 */
export function AdminBarChart({ title, labels, values, format }: { title: string; labels: string[]; values: number[]; format: (value: number) => string }) {
  const max = Math.max(...values, 0);
  const width = 600;
  const height = 160;
  const gap = values.length > 45 ? 1 : 4;
  const barWidth = Math.max(2, (width - gap * (values.length - 1)) / Math.max(values.length, 1));
  const total = values.reduce((sum, value) => sum + value, 0);

  return (
    <figure className="flex flex-col gap-2">
      <svg role="img" aria-label={`${title}: ${format(total)} in total`} viewBox={`0 0 ${width} ${height + 4}`} preserveAspectRatio="none" className="h-40 w-full text-blue">
        <line x1="0" x2={width} y1={height + 1} y2={height + 1} stroke="var(--line)" strokeWidth="2" />
        {values.map((value, index) => {
          const barHeight = max === 0 ? 0 : Math.max(2, (value / max) * (height - 8));
          return value === 0 ? null : (
            <rect key={labels[index] ?? index} x={index * (barWidth + gap)} y={height - barHeight} width={barWidth} height={barHeight} rx="2" fill="currentColor" opacity="0.85">
              <title>{`${labels[index]}: ${format(value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-mute">
        <span>{labels[0]}</span>
        <span>{labels.at(-1)}</span>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{title}</caption>
          <tbody>
            {labels.map((label, index) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{format(values[index] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
