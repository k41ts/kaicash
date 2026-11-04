import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { BudgetSettings, UserProfile } from '../../types';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { formatRupiah, formatCurrency } from '../../utils/formatCurrency';
import { fetchChildrenProfiles } from '../../services/familyService';

export default function ParentBudgetScreen() {
  const user = useAuthStore((state) => state.user);
  const selectedChildId = useAuthStore((state) => state.selectedChildId);
  const setSelectedChildId = useAuthStore((state) => state.setSelectedChildId);
  const navigation = useNavigation<any>();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [children, setChildren] = useState<UserProfile[]>([]);
  const [activeChild, setActiveChild] = useState<UserProfile | null>(null);
  const [budget, setBudget] = useState<BudgetSettings | null>(null);

  const [dailyLimit, setDailyLimit] = useState('');
  const [weeklyLimit, setWeeklyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [limitType, setLimitType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  const fetchBudgetData = async (forceRefresh = false) => {
    if (!user) return;
    if (!forceRefresh) setLoading(true);
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

          // Get active child
          let currentActiveId = selectedChildId;
          if (!currentActiveId || !childIds.includes(currentActiveId)) {
            currentActiveId = childIds[0];
            setSelectedChildId(currentActiveId);
          }

          const activeProfile = profiles.find((p) => p.id === currentActiveId) || null;
          setActiveChild(activeProfile);

          if (currentActiveId) {
            const budgetRef = collection(db, 'budget_settings');
            const qBudget = query(budgetRef, where('childId', '==', currentActiveId));
            const budgetSnap = await getDocs(qBudget);
            
            if (!budgetSnap.empty) {
              const bData = budgetSnap.docs[0].data() as BudgetSettings;
              setBudget(bData);
              setDailyLimit(bData.dailyLimit ? bData.dailyLimit.toString() : '0');
              setWeeklyLimit(bData.weeklyLimit ? bData.weeklyLimit.toString() : '0');
              setMonthlyLimit(bData.monthlyLimit ? bData.monthlyLimit.toString() : '0');
              setLimitType(bData.limitType || (bData.dailyLimit && !bData.weeklyLimit ? 'daily' : bData.weeklyLimit ? 'weekly' : 'monthly'));
            } else {
              setBudget(null);
              setDailyLimit('');
              setWeeklyLimit('');
              setMonthlyLimit('');
              setLimitType('monthly');
            }
          }
        } else {
          setChildren([]);
          setActiveChild(null);
          setBudget(null);
          setDailyLimit('');
          setWeeklyLimit('');
          setMonthlyLimit('');
          setLimitType('monthly');
        }
      } else {
        setChildren([]);
        setActiveChild(null);
        setBudget(null);
        setDailyLimit('');
        setWeeklyLimit('');
        setMonthlyLimit('');
        setLimitType('monthly');
      }
    } catch (error) {
      console.error('Error fetching budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBudgetData(true);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchBudgetData();
  }, [user, selectedChildId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchBudgetData();
    });
    return unsubscribe;
  }, [navigation]);

  const handleSaveBudget = async () => {
    if (!selectedChildId) {
      Alert.alert('Error', 'Belum ada anak yang dipilih.');
      return;
    }
    
    const cleanDaily = dailyLimit.replace(/[^0-9]/g, '');
    const cleanWeekly = weeklyLimit.replace(/[^0-9]/g, '');
    const cleanMonthly = monthlyLimit.replace(/[^0-9]/g, '');
    const daily = parseFloat(cleanDaily) || 0;
    const weekly = parseFloat(cleanWeekly) || 0;
    const monthly = parseFloat(cleanMonthly) || 0;
    
    if (limitType === 'daily' && (isNaN(daily) || daily <= 0)) {
      Alert.alert('Error', 'Silakan masukkan batas harian yang valid.');
      return;
    }
    if (limitType === 'weekly' && (isNaN(weekly) || weekly <= 0)) {
      Alert.alert('Error', 'Silakan masukkan batas mingguan yang valid.');
      return;
    }
    if (limitType === 'monthly' && (isNaN(monthly) || monthly <= 0)) {
      Alert.alert('Error', 'Silakan masukkan batas bulanan yang valid.');
      return;
    }

    try {
      setLoading(true);
      
      const bRef = budget ? doc(db, 'budget_settings', budget.id) : doc(collection(db, 'budget_settings'));
      const newBudget: BudgetSettings = {
        id: bRef.id,
        childId: selectedChildId,
        parentId: user!.uid,
        dailyLimit: limitType === 'daily' ? daily : 0,
        weeklyLimit: limitType === 'weekly' ? weekly : 0,
        monthlyLimit: limitType === 'monthly' ? monthly : 0,
        limitType: limitType
      };
      
      await setDoc(bRef, newBudget);

      // Create notification for child
      const notifRef = doc(collection(db, 'notifications'));
      const limitAmount = limitType === 'daily' ? daily : limitType === 'weekly' ? weekly : monthly;
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: selectedChildId,
        title: 'Batas Budget Diperbarui',
        body: `Ortu telah memperbarui batas budget ${limitType === 'daily' ? 'harian' : limitType === 'weekly' ? 'mingguan' : 'bulanan'} kamu menjadi ${formatCurrency(limitAmount, activeChild?.currency)}`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      Alert.alert('Sukses', `Batas budget ${limitType === 'daily' ? 'harian' : limitType === 'weekly' ? 'mingguan' : 'bulanan'} untuk ${activeChild?.name} berhasil disimpan!`);
      await fetchBudgetData();
    } catch (error) {
      Alert.alert('Error', 'Gagal menyimpan konfigurasi budget.');
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Budgeting</Text>
          {activeChild && (
            <View style={styles.activeChildBadge}>
              <View style={styles.dot} />
              <Text style={styles.activeChildName}>{activeChild.name}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#6643FF" />
          </View>
        ) : !selectedChildId ? (
          <Animated.View entering={FadeInDown.duration(800)}>
            <BlurView intensity={25} tint="dark" style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <Feather name="link-2" size={40} color="#6643FF" />
              </View>
              <Text style={styles.emptyTitle}>Belum Ada Anak Terhubung</Text>
              <Text style={styles.emptySubtitle}>Go to the Link Child tab to link your child's account.</Text>
            </BlurView>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(800)}>
            <BlurView intensity={25} tint="dark" style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="shield-checkmark-outline" size={32} color="#6643FF" />
                <View style={styles.cardHeaderTexts}>
                  <Text style={styles.cardTitle}>Atur Batas Belanja</Text>
                  <Text style={styles.cardSubtitle}>
                    Batasi nominal belanja harian, mingguan, atau bulanan untuk {activeChild?.name}.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Limit Type Segmented Control */}
              <View style={styles.segmentedControl}>
                <TouchableOpacity 
                  style={[styles.segmentButton, limitType === 'daily' && styles.segmentButtonActive]}
                  onPress={() => setLimitType('daily')}
                >
                  <Text style={[styles.segmentText, limitType === 'daily' && styles.segmentTextActive]}>Harian</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.segmentButton, limitType === 'weekly' && styles.segmentButtonActive]}
                  onPress={() => setLimitType('weekly')}
                >
                  <Text style={[styles.segmentText, limitType === 'weekly' && styles.segmentTextActive]}>Mingguan</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.segmentButton, limitType === 'monthly' && styles.segmentButtonActive]}
                  onPress={() => setLimitType('monthly')}
                >
                  <Text style={[styles.segmentText, limitType === 'monthly' && styles.segmentTextActive]}>Bulanan</Text>
                </TouchableOpacity>
              </View>

              {limitType === 'daily' ? (
                <>
                  <Text style={styles.label}>Batas Harian ({activeChild?.currency || 'IDR'})</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.currencyPrefix}>{activeChild?.currency === 'USD' ? '$' : 'Rp'}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={activeChild?.currency === 'USD' ? 'e.g. 10' : 'e.g. 50000'}
                      placeholderTextColor="#555566"
                      keyboardType="numeric"
                      value={dailyLimit}
                      onChangeText={setDailyLimit}
                    />
                  </View>
                </>
              ) : limitType === 'weekly' ? (
                <>
                  <Text style={styles.label}>Batas Mingguan ({activeChild?.currency || 'IDR'})</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.currencyPrefix}>{activeChild?.currency === 'USD' ? '$' : 'Rp'}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={activeChild?.currency === 'USD' ? 'e.g. 50' : 'e.g. 250000'}
                      placeholderTextColor="#555566"
                      keyboardType="numeric"
                      value={weeklyLimit}
                      onChangeText={setWeeklyLimit}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Batas Bulanan ({activeChild?.currency || 'IDR'})</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.currencyPrefix}>{activeChild?.currency === 'USD' ? '$' : 'Rp'}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={activeChild?.currency === 'USD' ? 'e.g. 300' : 'e.g. 1500000'}
                      placeholderTextColor="#555566"
                      keyboardType="numeric"
                      value={monthlyLimit}
                      onChangeText={setMonthlyLimit}
                    />
                  </View>
                </>
              )}
              
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveBudget} disabled={loading}>
                <LinearGradient
                  colors={['#6643FF', '#3D28E0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Feather name="save" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.saveButtonText}>{loading ? 'Menyimpan...' : 'Simpan Limit'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        )}
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
  centerContainer: {
    marginTop: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  activeChildBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 67, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(102, 67, 255, 0.3)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E676',
    marginRight: 6,
  },
  activeChildName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(102, 67, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(102, 67, 255, 0.2)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#A0A0B0',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTexts: {
    marginLeft: 14,
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#A0A0B0',
    marginTop: 3,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 12,
  },
  label: {
    color: '#A0A0B0',
    marginBottom: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  currencyPrefix: {
    color: '#6643FF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  segmentButtonActive: {
    backgroundColor: '#6643FF',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888899',
  },
  segmentTextActive: {
    color: '#FFF',
  },
});
