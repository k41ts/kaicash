import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { useAuthStore } from '../store/authStore';
import { fetchUserProfile } from '../services/authService';

import AuthNavigator from './AuthNavigator';
import ParentNavigator from './ParentNavigator';
import ChildNavigator from './ChildNavigator';
import { ActivityIndicator, View, Image, StyleSheet } from 'react-native';

export default function RootNavigator() {
  const { user, userProfile, isLoading, setUser, setUserProfile, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Prevent flashing old user data
        if (useAuthStore.getState().userProfile?.id !== currentUser.uid) {
          setUserProfile(null);
        }
        try {
          const profile = await fetchUserProfile(currentUser.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error fetching user profile in auth listener', error);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Image 
          source={require('../../assets/icon.png')} 
          style={styles.loadingIcon} 
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#6643FF" style={styles.loadingIndicator} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {(!user || !userProfile) ? (
        <AuthNavigator />
      ) : userProfile?.role === 'Parent' ? (
        <ParentNavigator />
      ) : (
        <ChildNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingIcon: {
    width: 140,
    height: 140,
    marginBottom: 24,
  },
  loadingIndicator: {
    marginTop: 10,
  },
});
