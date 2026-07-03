import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface PredictionChartProps {
  homeTeam: string
  awayTeam: string
  homeWinProb: number
  drawProb: number
  awayWinProb: number
}

export default function PredictionChart({ homeTeam, awayTeam, homeWinProb, drawProb, awayWinProb }: PredictionChartProps) {
  const data = [
    { name: homeTeam, prob: +(homeWinProb * 100).toFixed(1), fill: '#2563eb' },
    { name: 'Draw', prob: +(drawProb * 100).toFixed(1), fill: '#6b7280' },
    { name: awayTeam, prob: +(awayWinProb * 100).toFixed(1), fill: '#7c3aed' },
  ]

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#f3f4f6', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          formatter={(value: number) => [`${value}%`, 'Probability']}
        />
        <Bar dataKey="prob" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
