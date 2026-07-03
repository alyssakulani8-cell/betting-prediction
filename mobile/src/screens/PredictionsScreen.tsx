import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { predictionsService } from '../services/predictions'

export default function PredictionsScreen() {
  const [predictions, setPredictions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    predictionsService.getPredictions()
      .then(setPredictions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#60a5fa" size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Predictions</Text>
      {predictions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No predictions available</Text>
        </View>
      ) : (
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.league}>{item.league}</Text>
                <Text style={styles.date}>{new Date(item.kickoff).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.match}>{item.homeTeam} vs {item.awayTeam}</Text>
              <Text style={styles.score}>Predicted: {item.predictedScore}</Text>
              <View style={styles.probBar}>
                <View style={[styles.barSegment, { flex: item.homeWinProb, backgroundColor: '#2563eb' }]} />
                <View style={[styles.barSegment, { flex: item.drawProb, backgroundColor: '#6b7280' }]} />
                <View style={[styles.barSegment, { flex: item.awayWinProb, backgroundColor: '#7c3aed' }]} />
              </View>
              <View style={styles.probLabels}>
                <Text style={[styles.probText, { color: '#60a5fa' }]}>H {(item.homeWinProb * 100).toFixed(0)}%</Text>
                <Text style={[styles.probText, { color: '#9ca3af' }]}>D {(item.drawProb * 100).toFixed(0)}%</Text>
                <Text style={[styles.probText, { color: '#a78bfa' }]}>A {(item.awayWinProb * 100).toFixed(0)}%</Text>
              </View>
              <Text style={styles.confidence}>Confidence: {(item.confidence * 100).toFixed(0)}%</Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#f3f4f6', marginBottom: 16 },
  emptyCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { color: '#6b7280', fontSize: 14 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  league: { fontSize: 11, color: '#9ca3af', backgroundColor: '#1f2937', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  date: { fontSize: 11, color: '#6b7280' },
  match: { fontSize: 15, fontWeight: '600', color: '#f3f4f6', marginBottom: 2 },
  score: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
  probBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#1f2937' },
  barSegment: { height: '100%' },
  probLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  probText: { fontSize: 11, fontWeight: '500' },
  confidence: { fontSize: 11, color: '#6b7280', marginTop: 6, textAlign: 'center' },
})
