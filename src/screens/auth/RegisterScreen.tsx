import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { registerUser, loginWithGoogle } from '../../services/authService';
import { Role } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { FontAwesome, Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Child');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const navigation = useNavigation<RegisterScreenNavigationProp>();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const { userProfile } = await registerUser(email, password, name, role);
      setUserProfile(userProfile);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      setGoogleLoading(true);
      const { userProfile, isNewUser } = await loginWithGoogle();
      
      if (isNewUser) {
        navigation.navigate('RoleSelection');
      } else {
        setUserProfile(userProfile);
      }
    } catch (err: any) {
      Alert.alert('Google Sign-In Failed', err.message || 'Something went wrong.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#050508', '#0A0C22', '#0E0A24', '#050508']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <Image 
              source={require('../../../assets/icontransparent.png')} 
              style={styles.logoImage} 
              resizeMode="contain"
            />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join us and manage your family finances</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <BlurView intensity={20} tint="dark" style={styles.glassCard}>
              
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <View style={styles.roleContainer}>
                <Text style={styles.label}>I am a:</Text>
                <View style={styles.roleButtonsWrapper}>
                  <TouchableOpacity 
                    style={[styles.roleButton, role === 'Child' && styles.roleButtonActive]}
                    onPress={() => setRole('Child')}
                    activeOpacity={0.8}
                  >
                    <Feather name="user" size={20} color={role === 'Child' ? '#FFF' : '#888899'} style={{marginBottom: 4}} />
                    <Text style={[styles.roleButtonText, role === 'Child' && styles.roleButtonTextActive]}>Child</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.roleButton, role === 'Parent' && styles.roleButtonActive]}
                    onPress={() => setRole('Parent')}
                    activeOpacity={0.8}
                  >
                    <Feather name="users" size={20} color={role === 'Parent' ? '#FFF' : '#888899'} style={{marginBottom: 4}} />
                    <Text style={[styles.roleButtonText, role === 'Parent' && styles.roleButtonTextActive]}>Parent</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading || googleLoading}>
                <LinearGradient
                  colors={['#6643FF', '#3D28E0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.divider} />
              </View>

              <TouchableOpacity 
                style={styles.googleButton} 
                onPress={handleGoogleRegister} 
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <FontAwesome name="google" size={20} color="#FFF" style={styles.googleIcon} />
                    <Text style={styles.googleButtonText}>Sign Up with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </BlurView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(600)}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkContainer}>
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Login here</Text></Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 40,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0A0B0',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A0A0A0',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    color: '#FFF',
    fontSize: 16,
  },
  roleContainer: {
    marginBottom: 24,
  },
  roleButtonsWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#6643FF',
    borderColor: '#6643FF',
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8E8E9F',
  },
  roleButtonTextActive: {
    color: '#FFF',
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  gradientButton: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    color: '#A0A0A0',
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  linkText: {
    color: '#A0A0A0',
    fontSize: 14,
  },
  linkHighlight: {
    color: '#6643FF',
    fontWeight: 'bold',
  },
});
