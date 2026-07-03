import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { analysisService } from '../services/analysis'
import FormChart from '../components/FormChart'

export default function AnalysisScreen() {
  const [teamId, setTeamId] = useState('')
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!teamId.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await analysisService.getTeamAnalysis(teamId)
      setAnalysis(data)
    } catch {
      setError('Team not found')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Deep Analysis</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Team ID (e.g. mci)"
          placeholderTextColor="#6b7280"
          value={teamId}
          onChangeText={setTeamId}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.button} onPress={handleSearch} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? '...' : 'Go'}</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color="#60a5fa" style={{ marginTop: 24 }} />
      ) : analysis ? (
        <>
          <View style={styles.card}>
            <Text style={styles.teamName}>{analysis.name}</Text>
            {analysis.form ? (
              <View style={styles.formRow}>
                {analysis.form.split('-').map((r: string, i: number) => (
                  <View
                    key={i}
                    style={[
                      styles.formBadge,
                      { backgroundColor: r === 'W' ? '#166534' : r === 'L' ? '#991b1b' : '#525252' },
                    ]}
                  >
                    <Text style={styles.formText}>{r}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {analysis.form && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Form Distribution</Text>
              <FormChart form={analysis.form} />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <View style={styles.statGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{analysis.avgGoalsScored}</Text>
                <Text style={styles.statLabel}>GF</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{analysis.avgGoalsConceded}</Text>
                <Text style={styles.statLabel}>GA</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{analysis.xGPerMatch}</Text>
                <Text style={styles.statLabel}>xG</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{analysis.xGAPerMatch}</Text>
                <Text style={styles.statLabel}>xGA</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Possession: {analysis.possessionAvg}%</Text>
              <Text style={styles.metaText}>Clean Sheet: {(analysis.cleanSheetPct * 100).toFixed(0)}%</Text>
              <Text style={styles.metaText}>BTTS: {(analysis.bttsPct * 100).toFixed(0)}%</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Search for a team to see analysis</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#f3f4f6', marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: '#f3f4f6',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#ef4444', fontSize: 12, marginBottom: 8 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginTop: 12,
  },
  teamName: { fontSize: 20, fontWeight: 'bold', color: '#f3f4f6', marginBottom: 8 },
  formRow: { flexDirection: 'row', gap: 4, marginBottom: 16 },
  formBadge: { width: 24, height: 24, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  formText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#f3f4f6', marginBottom: 12 },
  statGrid: { flexDirection: 'row', gap: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#60a5fa' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  metaText: { fontSize: 12, color: '#9ca3af', backgroundColor: '#1f2937', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' },
  placeholder: {
    marginTop: 24,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 24,
    alignItems: 'center',
  },
  placeholderText: { color: '#6b7280', fontSize: 14 },
})
