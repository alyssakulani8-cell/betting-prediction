import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { predictionsService } from '../services/predictions'

export default function HomeScreen() {
  const { user } = useAuth()
  const [predictions, setPredictions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    predictionsService.getPredictions()
      .then(setPredictions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const accuracy = 78
  const roi = 12.3

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome, {user?.name}</Text>
        <Text style={styles.subtitle}>AI-Powered Betting Predictions</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#60a5fa" style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{accuracy}%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{predictions.length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#4ade80' }]}>+{roi}%</Text>
              <Text style={styles.statLabel}>ROI</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Upcoming Matches</Text>
          {predictions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No predictions available</Text>
            </View>
          ) : (
            predictions.slice(0, 5).map((p: any) => (
              <View key={p.id} style={styles.predictionCard}>
                <View style={styles.matchHeader}>
                  <Text style={styles.leagueText}>{p.league}</Text>
                  <Text style={styles.dateText}>{new Date(p.kickoff).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.matchText}>{p.homeTeam} vs {p.awayTeam}</Text>
                <Text style={styles.scoreText}>Predicted: {p.predictedScore}</Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#f3f4f6' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#60a5fa' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#f3f4f6', marginBottom: 12 },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  emptyText: { color: '#6b7280', fontSize: 14 },
  predictionCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 8,
  },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  leagueText: { fontSize: 11, color: '#6b7280', backgroundColor: '#1f2937', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  dateText: { fontSize: 11, color: '#6b7280' },
  matchText: { fontSize: 16, fontWeight: '600', color: '#f3f4f6', marginBottom: 4 },
  scoreText: { fontSize: 13, color: '#9ca3af' },
})
