'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Répartition des employés actifs par département (barres Recharts, design §6.2).
 * Couleurs héritées des tokens GFEP via `currentColor` ; liste lisible pour les
 * lecteurs d'écran en complément du graphique.
 */
export function HeadcountChart({ data }: { data: Array<{ code: string; name: string; count: number }> }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="h-48 w-full text-foreground-secondary" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <XAxis dataKey="code" tick={{ fill: 'currentColor', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: 'currentColor', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'currentColor', fillOpacity: 0.08 }}
              contentStyle={{
                backgroundColor: 'var(--color-background-surface)',
                borderColor: 'var(--color-border)',
                borderRadius: 8,
                color: 'var(--color-foreground-primary)',
              }}
              formatter={(value: number) => [`${value} employé${value === 1 ? '' : 's'}`, 'Effectif']}
              labelFormatter={(code: string) => data.find((d) => d.code === code)?.name ?? code}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} className="fill-link" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${d.name} : ${d.count}`).join(', ')}
      </figcaption>
    </figure>
  );
}
