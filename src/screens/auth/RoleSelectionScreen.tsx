import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { setGoogleUserRole } from '../../services/authService';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { Role } from '../../types';

export default function RoleSelectionScreen() {
  const user = useAuthStore((state) => state.user);
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const [loading, setLoading] = useState(false);

  const handleSelectRole = async (role: Role) => {
    if (!user) return;
    setLoading(true);
    try {
      const profile = await setGoogleUserRole(user, role);
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to set role', error);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>Before we start, please select your role to setup your account.</Text>
      </Animated.View>

      <View style={styles.roleContainer}>
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <TouchableOpacity 
            onPress={() => handleSelectRole('Parent')} 
            disabled={loading}
          >
            <BlurView intensity={20} tint="dark" style={styles.roleCard}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(61, 40, 224, 0.2)' }]}>
                <Feather name="users" size={32} color="#3D28E0" />
              </View>
              <View style={styles.roleTextContainer}>
                <Text style={styles.roleTitle}>I'm a Parent</Text>
                <Text style={styles.roleDesc}>Manage allowance, set goals, and monitor spending</Text>
              </View>
              <Feather name="chevron-right" size={24} color="#A0A0A0" />
            </BlurView>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <TouchableOpacity 
            onPress={() => handleSelectRole('Child')} 
            disabled={loading}
          >
            <BlurView intensity={20} tint="dark" style={styles.roleCard}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(0, 230, 118, 0.2)' }]}>
                <Feather name="user" size={32} color="#00E676" />
              </View>
              <View style={styles.roleTextContainer}>
                <Text style={styles.roleTitle}>I'm a Child</Text>
                <Text style={styles.roleDesc}>Track your allowance, save money, and log expenses</Text>
              </View>
              <Feather name="chevron-right" size={24} color="#A0A0A0" />
            </BlurView>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3D28E0" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0A0A0',
    lineHeight: 24,
  },
  roleContainer: {
    gap: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  roleDesc: {
    fontSize: 13,
    color: '#A0A0A0',
    lineHeight: 18,
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
