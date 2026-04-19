/**
 * Mobile app scaffold — dormant until M5.
 * Do not add feature code here before both demo scenarios pass on web.
 */
import { Text, View, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🌱</Text>
      <Text style={styles.title}>Community Garden</Text>
      <Text style={styles.subtitle}>Mobile app — coming in M5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
  },
  emoji:    { fontSize: 48, marginBottom: 12 },
  title:    { fontSize: 24, fontWeight: '700', color: '#15803d' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 6 },
});
