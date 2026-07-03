import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const [notificationLevel, setNotificationLevel] = useState('All')
  const levels = ['All', 'Important', 'None']

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.profileCard}>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.optionRow}>
          {levels.map((l) => (
            <TouchableOpacity
              key={l}
              style={[styles.optionChip, notificationLevel === l && styles.optionChipActive]}
              onPress={() => setNotificationLevel(l)}
            >
              <Text style={[styles.optionChipText, notificationLevel === l && styles.optionChipTextActive]}>
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#f3f4f6', marginBottom: 16 },
  profileCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 16,
  },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#f3f4f6' },
  profileEmail: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 14, color: '#9ca3af', marginBottom: 8 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  optionChipActive: { backgroundColor: '#1e3a5f', borderColor: '#2563eb' },
  optionChipText: { color: '#9ca3af', fontSize: 14 },
  optionChipTextActive: { color: '#60a5fa', fontWeight: '600' },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: '#7f1d1d',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#fca5a5', fontSize: 16, fontWeight: '600' },
})
