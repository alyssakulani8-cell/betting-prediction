import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export default function AnalysisScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Deep Analysis</Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Advanced analytics and charts</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#f3f4f6', marginBottom: 16 },
  placeholder: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { color: '#6b7280', fontSize: 14 },
})
