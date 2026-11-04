import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { logoutUser, linkGoogleAccount } from '../../services/authService';
import { unlinkChild, fetchChildrenProfiles, createFamilyAndLink } from '../../services/familyService';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather, Ionicons, FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { UserProfile } from '../../types';
import { useNavigation } from '@react-navigation/native';

export default function ParentSettingsScreen() {
  const user = useAuthStore((state) => state.user);
  const userProfile = useAuthStore((state) => state.userProfile);
  const selectedChildId = useAuthStore((state) => state.selectedChildId);
  const setSelectedChildId = useAuthStore((state) => state.setSelectedChildId);
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<UserProfile[]>([]);

  // Edit Name states
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editTarget, setEditTarget] = useState<{ type: 'parent' } | { type: 'child'; id: string; currentName: string } | null>(null);

  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [linking, setLinking] = useState(false);

  // Link Child states
  const [pairingCode, setPairingCode] = useState('');
  const [linkingChild, setLinkingChild] = useState(false);

  const checkGoogleLink = () => {
    const { auth } = require('../../config/firebaseConfig');
    const linked = auth.currentUser?.providerData.some((p: any) => p.providerId === 'google.com') || false;
    setIsGoogleLinked(linked);
  };

  useEffect(() => {
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

  const fetchLinkedChildren = async () => {
    if (!user) return;
    try {
      const familyRef = collection(db, 'families');
      const qFam = query(familyRef, where('parentId', '==', user.uid));
      const famSnap = await getDocs(qFam);
      
      if (!famSnap.empty) {
        const familyData = famSnap.docs[0].data();
        const childIds = familyData.childIds || [];
        if (childIds.length > 0) {
          const profiles = await fetchChildrenProfiles(childIds);
          setChildren(profiles);
          return;
        }
      }
      setChildren([]);
    } catch (error) {
      console.error('Error fetching linked children:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchLinkedChildren();
    });
    return unsubscribe;
  }, [navigation, user]);

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
    if (!user || !editTarget) return;

    setSavingName(true);
    try {
      const { doc, updateDoc } = require('firebase/firestore');
      const targetId = editTarget.type === 'parent' ? user.uid : editTarget.id;

      await updateDoc(doc(db, 'users', targetId), {
        name: newNameInput.trim()
      });

      if (editTarget.type === 'parent') {
        // Update local store
        const updatedProfile = { ...userProfile, name: newNameInput.trim() };
        useAuthStore.getState().setUserProfile(updatedProfile as any);
        Alert.alert('Sukses', 'Nama profil Anda berhasil diperbarui!');
      } else {
        // Update local children list state
        setChildren(prev => prev.map(c => c.id === editTarget.id ? { ...c, name: newNameInput.trim() } : c));
        Alert.alert('Sukses', 'Nama profil anak berhasil diperbarui!');
      }

      setIsNameModalVisible(false);
      setEditTarget(null);
    } catch (error) {
      console.error('Error updating name:', error);
      Alert.alert('Error', 'Gagal memperbarui nama.');
    } finally {
      setSavingName(false);
    }
  };

  const handleUnlink = (child: UserProfile) => {
    Alert.alert(
      'Putuskan Hubungan',
      `Apakah Anda yakin ingin memutuskan hubungan pemantauan dengan akun ${child.name}?`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Ya, Hapus', 
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setLoading(true);
            try {
              await unlinkChild(user.uid, child.id);
              Alert.alert('Sukses', `Hubungan dengan ${child.name} berhasil dihapus.`);
              
              // If we deleted the currently selected child, clear it or select another
              if (selectedChildId === child.id) {
                setSelectedChildId(null);
              }
              
              await fetchLinkedChildren();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Gagal memutuskan hubungan.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveChildCurrency = async (newCurrency: string) => {
    if (!selectedChildId) return;
    try {
      const { doc, updateDoc } = require('firebase/firestore');
      const { db } = require('../../config/firebaseConfig');
      
      await updateDoc(doc(db, 'users', selectedChildId), {
        currency: newCurrency
      });
      
      // Update local children state to trigger re-render
      setChildren(prev => prev.map(c => c.id === selectedChildId ? { ...c, currency: newCurrency } : c));
      
      Alert.alert('Sukses', `Mata uang anak berhasil diubah ke ${newCurrency}!`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal memperbarui mata uang anak.');
    }
  };

  const handleLinkChild = async () => {
    if (!pairingCode) {
      Alert.alert('Error', 'Silakan masukkan kode pairing.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Anda harus login terlebih dahulu.');
      return;
    }

    try {
      setLinkingChild(true);
      await createFamilyAndLink(user.uid, pairingCode.trim());
      Alert.alert('Sukses', 'Akun anak berhasil ditambahkan!');
      setPairingCode('');
      await fetchLinkedChildren();
    } catch (error: any) {
      Alert.alert('Gagal Menghubungkan', error.message || 'Periksa kembali kode pairing anak Anda.');
    } finally {
      setLinkingChild(false);
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <BlurView intensity={25} tint="dark" style={styles.card}>
            <Text style={styles.sectionTitle}>Profil Orang Tua</Text>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Nama</Text>
              <View style={styles.nameContainer}>
                <Text style={styles.value}>{userProfile?.name}</Text>
                <TouchableOpacity 
                  style={styles.editBtn}
                  onPress={() => {
                    setNewNameInput(userProfile?.name || '');
                    setEditTarget({ type: 'parent' });
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

        {/* Hubungkan Akun Anak Baru (Link Child) */}
        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={{ marginTop: 10 }}>
          <BlurView intensity={25} tint="dark" style={styles.card}>
            <Text style={styles.sectionTitle}>Hubungkan Akun Anak Baru</Text>
            <Text style={styles.helperText}>
              Minta anak Anda membuka menu Settings di aplikasinya dan bagikan 6-digit kode pairing unik mereka di sini.
            </Text>
            <View style={styles.inputWrapper}>
              <Feather name="key" size={18} color="#6643FF" style={{ marginRight: 12 }} />
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
            <TouchableOpacity style={styles.linkButton} onPress={handleLinkChild} disabled={linkingChild}>
              <LinearGradient
                colors={['#6643FF', '#3D28E0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientButton}
              >
                {linkingChild ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="plus-circle" size={16} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Hubungkan Akun</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>

        {/* Linked Children List Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={{ marginTop: 10 }}>
          <BlurView intensity={25} tint="dark" style={styles.card}>
            <Text style={styles.sectionTitle}>Akun Anak Terhubung</Text>
            
            {loading ? (
              <ActivityIndicator color="#6643FF" style={{ marginVertical: 20 }} />
            ) : children.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="users" size={24} color="#444" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyText}>Belum ada akun anak yang terhubung.</Text>
              </View>
            ) : (
              children.map((child) => (
                <View key={child.id} style={styles.childItem}>
                  <View style={styles.childLeft}>
                    <View style={styles.childAvatar}>
                      <Text style={styles.childAvatarText}>{child.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.childName}>{child.name}</Text>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => {
                            setNewNameInput(child.name);
                            setEditTarget({ type: 'child', id: child.id, currentName: child.name });
                            setIsNameModalVisible(true);
                          }}
                        >
                          <Feather name="edit-2" size={12} color="#6643FF" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.childEmail}>{child.email}</Text>
                      {child.pairingCode && (
                        <Text style={styles.childPairingCode}>Kode Pairing: {child.pairingCode}</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.unlinkButton}
                    onPress={() => handleUnlink(child)}
                  >
                    <Feather name="trash-2" size={18} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </BlurView>
        </Animated.View>

        {/* Set Currency for Selected Child */}
        {selectedChildId && children.some(c => c.id === selectedChildId) && (
          <Animated.View entering={FadeInDown.delay(250).duration(500)} style={{ marginTop: 10 }}>
            <BlurView intensity={25} tint="dark" style={styles.card}>
              <Text style={styles.sectionTitle}>
                Mata Uang Anak ({children.find(c => c.id === selectedChildId)?.name})
              </Text>
              <Text style={styles.helperText}>Pilih mata uang utama untuk pencatatan keuangan anak Anda.</Text>
              
              <View style={styles.currencyToggleRow}>
                <TouchableOpacity 
                  style={[
                    styles.currencyButton, 
                    (!children.find(c => c.id === selectedChildId)?.currency || children.find(c => c.id === selectedChildId)?.currency === 'IDR') && styles.currencyButtonActive
                  ]}
                  onPress={() => handleSaveChildCurrency('IDR')}
                >
                  <Text style={[
                    styles.currencyText,
                    (!children.find(c => c.id === selectedChildId)?.currency || children.find(c => c.id === selectedChildId)?.currency === 'IDR') && styles.currencyTextActive
                  ]}>Rupiah (IDR)</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.currencyButton, 
                    children.find(c => c.id === selectedChildId)?.currency === 'USD' && styles.currencyButtonActive
                  ]}
                  onPress={() => handleSaveChildCurrency('USD')}
                >
                  <Text style={[
                    styles.currencyText,
                    children.find(c => c.id === selectedChildId)?.currency === 'USD' && styles.currencyTextActive
                  ]}>Dollar (USD)</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>
        )}

        {/* Logout Button */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={{ marginTop: 10 }}>
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
                <Text style={styles.modalTitle}>
                  {editTarget?.type === 'parent' ? 'Ubah Nama Profil Anda' : `Ubah Nama ${editTarget?.currentName}`}
                </Text>
                <TouchableOpacity onPress={() => {
                  setIsNameModalVisible(false);
                  setEditTarget(null);
                }}>
                  <Feather name="x" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>
                {editTarget?.type === 'parent' 
                  ? 'Perbarui nama lengkap atau nama panggilan Anda di sini.' 
                  : `Perbarui nama lengkap atau nama panggilan untuk akun ${editTarget?.currentName}.`}
              </Text>

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
                    setEditTarget(null);
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6643FF',
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
  modalSubtitle: {
    color: '#A0A0B4',
    fontSize: 13,
    marginBottom: 20,
    paddingHorizontal: 4,
    lineHeight: 18,
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
    fontSize: 15,
    color: '#A0A0B0',
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#88889C',
    fontSize: 14,
  },
  childItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  childLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3E3A68',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  childAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  childName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  childEmail: {
    color: '#888899',
    fontSize: 13,
    marginTop: 2,
  },
  childPairingCode: {
    color: '#6643FF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  unlinkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.2)',
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
  helperText: {
    fontSize: 13,
    color: '#88889C',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  currencyToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
