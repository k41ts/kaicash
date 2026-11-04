import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { createFamilyAndLink } from '../../services/familyService';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export default function AddChildScreen() {
  const user = useAuthStore((state) => state.user);
  const setSelectedChildId = useAuthStore((state) => state.setSelectedChildId);
  const navigation = useNavigation<any>();
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    if (!pairingCode) {
      Alert.alert('Error', 'Silakan masukkan kode pairing.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Anda harus login terlebih dahulu.');
      return;
    }

    try {
      setLoading(true);
      await createFamilyAndLink(user.uid, pairingCode.trim());
      Alert.alert('Sukses', 'Akun anak berhasil ditambahkan!');
      setPairingCode('');
      
      // Navigate to Dashboard and force refresh active context
      navigation.navigate('Dashboard');
    } catch (error: any) {
      Alert.alert('Gagal Menghubungkan', error.message || 'Periksa kembali kode pairing anak Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#080711', '#120E24', '#0A0815']}
      style={styles.gradientContainer}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Link Child</Text>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <BlurView intensity={25} tint="dark" style={styles.card}>
            <View style={styles.iconContainer}>
              <Feather name="link-2" size={38} color="#6643FF" />
            </View>
            <Text style={styles.cardTitle}>Hubungkan Akun Anak</Text>
            <Text style={styles.cardSubtitle}>
              Minta anak Anda membuka menu Settings di aplikasinya dan bagikan 6-digit kode pairing unik mereka di sini.
            </Text>

            <View style={styles.inputWrapper}>
              <Feather name="key" size={20} color="#6643FF" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder="Masukkan 6-digit Kode"
                placeholderTextColor="#555566"
                value={pairingCode}
                onChangeText={setPairingCode}
                autoCapitalize="none"
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleLink} disabled={loading}>
              <LinearGradient
                colors={['#6643FF', '#3D28E0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientButton}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="plus-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Hubungkan Akun</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingTop: 50,
    paddingBottom: 140,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  iconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(102, 67, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(102, 67, 255, 0.2)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#A0A0B0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 26,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
