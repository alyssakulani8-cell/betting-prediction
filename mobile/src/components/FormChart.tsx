import React from 'react'
import { View, Text, Dimensions, StyleSheet } from 'react-native'
import { BarChart } from 'react-native-chart-kit'

const screenWidth = Dimensions.get('window').width

interface FormChartProps {
  form: string
}

export default function FormChart({ form }: FormChartProps) {
  const results = form.split('-')
  const wins = results.filter((r) => r === 'W').length
  const draws = results.filter((r) => r === 'D').length
  const losses = results.filter((r) => r === 'L').length

  const data = {
    labels: ['W', 'D', 'L'],
    datasets: [{ data: [wins, draws, losses] }],
  }

  return (
    <View>
      <BarChart
        data={data}
        width={screenWidth - 64}
        height={180}
        yAxisSuffix=""
        chartConfig={{
          backgroundColor: '#111827',
          backgroundGradientFrom: '#111827',
          backgroundGradientTo: '#111827',
          decimalCount: 0,
          color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
          labelColor: () => '#9ca3af',
          barPercentage: 0.6,
          propsForBackgroundLines: { stroke: '#1f2937' },
        }}
        style={{ borderRadius: 8 }}
      />
    </View>
  )
}
