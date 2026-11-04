import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../store/authStore';
import { logoutUser, linkGoogleAccount } from '../../services/authService';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

export default function ChildSettingsScreen() {
  const user = useAuthStore((state) => state.user);
  const userProfile = useAuthStore((state) => state.userProfile);
  const navigation = useNavigation();

  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  // Edit Name states
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [linking, setLinking] = useState(false);

  const checkGoogleLink = () => {
    const { auth } = require('../../config/firebaseConfig');
    const linked = auth.currentUser?.providerData.some((p: any) => p.providerId === 'google.com') || false;
    setIsGoogleLinked(linked);
  };

  React.useEffect(() => {
    checkGoogleLink();
  }, [user]);

  const handleLinkGoogle = async () => {
    try {
      setLinking(true);
      await linkGoogleAccount();
      Alert.alert('Sukses', 'Akun Google berhasil dihubungkan!');
      checkGoogleLink();
    } catch (error: any) {
      if (error.code === 'SIGN_IN_CANCELLED') {
        Alert.alert('Batal', 'Anda membatalkan menghubungkan akun Google.');
      } else if (error.code === 'auth/credential-already-in-use') {
        Alert.alert('Error', 'Akun Google ini sudah terhubung dengan pengguna lain.');
      } else {
        Alert.alert('Gagal', error.message || 'Gagal menghubungkan akun Google.');
      }
    } finally {
      setLinking(false);
    }
  };

  React.useEffect(() => {
    const fetchCurrentBudget = async () => {
      if (!user) return;
      try {
        const { collection, query, where, getDocs } = require('firebase/firestore');
        const { db } = require('../../config/firebaseConfig');
        const budgetRef = collection(db, 'budget_settings');
        const q = query(budgetRef, where('childId', '==', user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const bData = snap.docs[0].data();
          if (bData.monthlyLimit) {
            setMonthlyBudget(bData.monthlyLimit.toString());
          }
        }
      } catch (e) {
        console.error('Failed to fetch budget:', e);
      }
    };
    fetchCurrentBudget();
  }, [user]);

  const copyToClipboard = async () => {
    if (userProfile?.pairingCode || user?.uid) {
      await Clipboard.setStringAsync(userProfile?.pairingCode || user!.uid);
      Alert.alert('Copied!', 'Your pairing code has been copied to clipboard.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Keluar Akun',
      'Apakah Anda yakin ingin keluar?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Keluar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
            } catch (error) {
              Alert.alert('Error', 'Gagal keluar.');
            }
          }
        }
      ]
    );
  };

  const handleSaveName = async () => {
    if (!newNameInput || !newNameInput.trim()) {
      Alert.alert('Error', 'Nama tidak boleh kosong.');
      return;
    }
    if (!user) return;

    setSavingName(true);
    try {
      const { doc, updateDoc } = require('firebase/firestore');
      const { db } = require('../../config/firebaseConfig');
      
      await updateDoc(doc(db, 'users', user.uid), {
        name: newNameInput.trim()
      });

      // Update local store
      const updatedProfile = { ...userProfile, name: newNameInput.trim() };
      useAuthStore.getState().setUserProfile(updatedProfile as any);

      Alert.alert('Sukses', 'Nama profil berhasil diperbarui!');
      setIsNameModalVisible(false);
    } catch (error) {
      console.error('Error updating name:', error);
      Alert.alert('Error', 'Gagal memperbarui nama.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!monthlyBudget) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    const amount = parseFloat(monthlyBudget.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid numeric amount.');
      return;
    }

    setSavingBudget(true);
    try {
      // Import necessary firestore methods inside or at top of file
      const { doc, setDoc, collection, query, where, getDocs } = require('firebase/firestore');
      const { db } = require('../../config/firebaseConfig');
      
      const budgetRef = collection(db, 'budget_settings');
      const q = query(budgetRef, where('childId', '==', user!.uid));
      const snap = await getDocs(q);
      
      let bRef;
      if (!snap.empty) {
        bRef = doc(db, 'budget_settings', snap.docs[0].id);
      } else {
        bRef = doc(collection(db, 'budget_settings'));
      }
      
      await setDoc(bRef, {
        id: bRef.id,
        childId: user!.uid,
        parentId: '', // It's fine if parentId is empty, or we could fetch family
        dailyLimit: 0,
        monthlyLimit: amount
      }, { merge: true });
      
      Alert.alert('Saved', 'Budget limit has been updated successfully!');
      setMonthlyBudget('');
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget.');
    } finally {
      setSavingBudget(false);
    }
  };

  const handleSaveCurrency = async (newCurrency: string) => {
    if (!user) return;
    try {
      const { doc, updateDoc } = require('firebase/firestore');
      const { db } = require('../../config/firebaseConfig');
      
      await updateDoc(doc(db, 'users', user.uid), {
        currency: newCurrency
      });
      
      // Update local auth store profile
      const updatedProfile = { ...userProfile, currency: newCurrency };
      useAuthStore.getState().setUserProfile(updatedProfile as any);
      
      Alert.alert('Sukses', `Mata uang berhasil diubah ke ${newCurrency}!`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal memperbarui mata uang.');
    }
  };

  return (
    <LinearGradient
      colors={['#050508', '#0A0C22', '#0E0A24', '#050508']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView 
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <BlurView intensity={25} tint="dark" style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Name</Text>
            <View style={styles.nameContainer}>
              <Text style={styles.value}>{userProfile?.name}</Text>
              <TouchableOpacity 
                style={styles.editBtn}
                onPress={() => {
                  setNewNameInput(userProfile?.name || '');
                  setIsNameModalVisible(true);
                }}
              >
                <Feather name="edit-2" size={14} color="#6643FF" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{userProfile?.email}</Text>
          </View>
          <View style={[styles.cardRow, styles.noBorder]}>
            <Text style={styles.label}>Koneksi Google</Text>
            {isGoogleLinked ? (
              <View style={styles.linkedBadge}>
                <FontAwesome name="google" size={14} color="#00E676" style={{ marginRight: 6 }} />
                <Text style={styles.linkedText}>Terhubung</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.linkGoogleButton} onPress={handleLinkGoogle} disabled={linking}>
                {linking ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <FontAwesome name="google" size={14} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.linkGoogleButtonText}>Hubungkan</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </BlurView>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(500)}>
        <BlurView intensity={25} tint="dark" style={styles.card}>
          <Text style={styles.cardTitle}>Pairing Code</Text>
          <Text style={styles.pairingCode}>{userProfile?.pairingCode || user?.uid}</Text>
          <TouchableOpacity style={styles.button} onPress={copyToClipboard}>
            <LinearGradient
              colors={['#6643FF', '#3D28E0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientButton}
            >
              <Feather name="copy" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Copy Code</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.helperText}>Give this code to your Parent so they can link to your account.</Text>
        </BlurView>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(250).duration(500)}>
        <BlurView intensity={25} tint="dark" style={styles.card}>
          <Text style={styles.cardTitle}>Set Monthly Budget Limit</Text>
          <Text style={styles.helperText}>Help yourself stay on track by setting a spending limit.</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 500000"
            placeholderTextColor="#666"
            keyboardType="numeric"
            value={monthlyBudget}
            onChangeText={setMonthlyBudget}
          />
          <TouchableOpacity style={styles.button} onPress={handleSaveBudget} disabled={savingBudget}>
            <LinearGradient
              colors={['#6643FF', '#3D28E0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientButton}
            >
              <Feather name="save" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>{savingBudget ? 'Saving...' : 'Save Limit'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </BlurView>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(280).duration(500)}>
        <BlurView intensity={25} tint="dark" style={styles.card}>
          <Text style={styles.cardTitle}>Set Currency / Mata Uang</Text>
          <Text style={styles.helperText}>Pilih mata uang utama untuk pencatatan keuangan Anda.</Text>
          
          <View style={styles.currencyToggleRow}>
            <TouchableOpacity 
              style={[
                styles.currencyButton, 
                (!userProfile?.currency || userProfile?.currency === 'IDR') && styles.currencyButtonActive
              ]}
              onPress={() => handleSaveCurrency('IDR')}
            >
              <Text style={[
                styles.currencyText,
                (!userProfile?.currency || userProfile?.currency === 'IDR') && styles.currencyTextActive
              ]}>Rupiah (IDR)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.currencyButton, 
                userProfile?.currency === 'USD' && styles.currencyButtonActive
              ]}
              onPress={() => handleSaveCurrency('USD')}
            >
              <Text style={[
                styles.currencyText,
                userProfile?.currency === 'USD' && styles.currencyTextActive
              ]}>Dollar (USD)</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(320).duration(500)} style={{ marginTop: 10 }}>
        <BlurView intensity={25} tint="dark" style={styles.logoutCard}>
          <TouchableOpacity style={styles.logoutContent} onPress={handleLogout}>
            <Feather name="log-out" size={20} color="#FF5252" style={{ marginRight: 8 }} />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </BlurView>
      </Animated.View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={isNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNameModalVisible(false)}
      >
        <View style={styles.centeredModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsNameModalVisible(false)}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={styles.centeredModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ubah Nama Profil</Text>
                <TouchableOpacity onPress={() => setIsNameModalVisible(false)}>
                  <Feather name="x" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Perbarui nama lengkap atau nama panggilan Anda di sini.</Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Masukkan nama baru"
                  placeholderTextColor="#555566"
                  value={newNameInput}
                  onChangeText={setNewNameInput}
                  autoFocus
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => {
                    setIsNameModalVisible(false);
                    setNewNameInput('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSave}
                  onPress={handleSaveName}
                  disabled={savingName}
                >
                  {savingName ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalSaveText}>Simpan</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    padding: 6,
  },
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centeredModalContent: {
    width: '100%',
    backgroundColor: '#0F0F14',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: '#A0A0B4',
    fontSize: 13,
    marginBottom: 20,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 16,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalCancelText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalSave: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#6643FF',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  cardTitle: {
    fontSize: 16,
    color: '#A0A0A0',
    marginBottom: 16,
    textAlign: 'center',
  },
  pairingCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6643FF',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 2,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  helperText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  logoutCard: {
    backgroundColor: 'rgba(255, 82, 82, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.25)',
    overflow: 'hidden',
  },
  logoutContent: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#FF5252',
    fontWeight: 'bold',
    fontSize: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#FFF',
    marginTop: 12,
  },
  currencyToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  currencyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
  },
  currencyButtonActive: {
    backgroundColor: '#6643FF',
    borderColor: '#6643FF',
  },
  currencyText: {
    color: '#8E8E9F',
    fontWeight: 'bold',
    fontSize: 14,
  },
  currencyTextActive: {
    color: '#FFF',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
  },
  linkedText: {
    color: '#00E676',
    fontWeight: 'bold',
    fontSize: 13,
  },
  linkGoogleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  linkGoogleButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
