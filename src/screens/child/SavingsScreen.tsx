import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { useAuthStore } from '../../store/authStore';
import { SavingsGoal, BalanceHistory } from '../../types';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { formatCurrency } from '../../utils/formatCurrency';
import { LinearGradient } from 'expo-linear-gradient';

export default function SavingsScreen() {
  const user = useAuthStore((state) => state.user);
  const userProfile = useAuthStore((state) => state.userProfile);
  const navigation = useNavigation();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');

  // Add Funds Modal states
  const [fundingGoal, setFundingGoal] = useState<SavingsGoal | null>(null);
  const [fundingAmount, setFundingAmount] = useState('');
  const [fundingLoading, setFundingLoading] = useState(false);

  const fetchGoals = async () => {
    if (!user) return;
    try {
      const goalsRef = collection(db, 'savings_goals');
      const q = query(goalsRef, where('childId', '==', user.uid));
      const snapshot = await getDocs(q);
      const fetchedGoals: SavingsGoal[] = [];
      snapshot.forEach(doc => {
        fetchedGoals.push(doc.data() as SavingsGoal);
      });
      setGoals(fetchedGoals);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [user]);

  const handleAddGoal = async () => {
    if (!goalName || !targetAmount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const cleanTarget = targetAmount.replace(/[^0-9]/g, '');
    const numTarget = parseFloat(cleanTarget);
    if (isNaN(numTarget) || numTarget <= 0) {
      Alert.alert('Error', 'Target amount must be a positive number');
      return;
    }

    try {
      setLoading(true);
      const newGoalRef = doc(collection(db, 'savings_goals'));
      const newGoal: SavingsGoal = {
        id: newGoalRef.id,
        childId: user!.uid,
        goalName,
        targetAmount: numTarget,
        currentAmount: 0,
        createdAt: new Date().toISOString(),
      };
      await setDoc(newGoalRef, newGoal);
      setIsAdding(false);
      setGoalName('');
      setTargetAmount('');
      await fetchGoals();
    } catch (error) {
      Alert.alert('Error', 'Failed to create savings goal');
    } finally {
      setLoading(false);
    }
  };

  const addFundsToGoal = (goal: SavingsGoal) => {
    setFundingGoal(goal);
    setFundingAmount('');
  };

  const handleConfirmAddFunds = async () => {
    if (!fundingGoal || !fundingAmount) return;
    const cleanStr = fundingAmount.replace(/[^0-9]/g, '');
    const amount = parseFloat(cleanStr);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Silakan masukkan nominal angka yang valid.');
      return;
    }

    try {
      setFundingLoading(true);
      const goalRef = doc(db, 'savings_goals', fundingGoal.id);
      await updateDoc(goalRef, {
        currentAmount: fundingGoal.currentAmount + amount
      });

      // Also record this in balance history as an OUT transaction
      const historyRef = doc(collection(db, 'balance_history'));
      const historyData: BalanceHistory = {
        id: historyRef.id,
        childId: user!.uid,
        amount: amount,
        description: `Saved for: ${fundingGoal.goalName}`,
        type: 'OUT',
        date: new Date().toISOString()
      };
      await setDoc(historyRef, historyData);

      // Find parent of this child and add a notification
      const familyRef = collection(db, 'families');
      const qFam = query(familyRef, where('childIds', 'array-contains', user!.uid));
      const famSnap = await getDocs(qFam);
      if (!famSnap.empty) {
        const familyData = famSnap.docs[0].data();
        const parentId = familyData.parentId;
        if (parentId) {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: parentId,
            title: 'Tabungan Baru Anak',
            body: `${userProfile?.name || 'Anak'} menabung sebesar ${formatCurrency(amount, userProfile?.currency)} untuk target "${fundingGoal.goalName}"`,
            isRead: false,
            createdAt: new Date().toISOString()
          });
        }
      }

      setFundingGoal(null);
      setFundingAmount('');
      Alert.alert('Sukses', 'Dana berhasil ditambahkan ke tabungan!');
      await fetchGoals();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal menambahkan dana.');
    } finally {
      setFundingLoading(false);
    }
  };

  // Remove local formatCurrency, using formatRupiah instead

  const renderItem = ({ item, index }: { item: SavingsGoal, index: number }) => {
    const progress = Math.min(100, (item.currentAmount / item.targetAmount) * 100);
    return (
      <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
        <BlurView intensity={20} tint="dark" style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.goalName}>{item.goalName}</Text>
            <Text style={styles.percentage}>{Math.round(progress)}%</Text>
          </View>
          <Text style={styles.amounts}>
            {formatCurrency(item.currentAmount, userProfile?.currency)} / {formatCurrency(item.targetAmount, userProfile?.currency)}
          </Text>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>

          <TouchableOpacity style={styles.addFundsBtn} onPress={() => addFundsToGoal(item)}>
            <Feather name="plus" size={16} color="#FFF" />
            <Text style={styles.addFundsText}>Add Funds</Text>
          </TouchableOpacity>
        </BlurView>
      </Animated.View>
    );
  };

  return (
    <LinearGradient
      colors={['#050508', '#0A0C22', '#0E0A24', '#050508']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="chevron-left" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings Goals</Text>
          <TouchableOpacity onPress={() => setIsAdding(!isAdding)}>
            <Feather name={isAdding ? 'x' : 'plus'} size={28} color="#6643FF" />
          </TouchableOpacity>
        </View>

        {isAdding && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <BlurView intensity={20} tint="dark" style={styles.addGoalCard}>
              <Text style={styles.label}>Goal Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. New Bicycle"
                placeholderTextColor="#666"
                value={goalName}
                onChangeText={setGoalName}
              />
              <Text style={styles.label}>Target Amount ({userProfile?.currency || 'IDR'})</Text>
              <TextInput
                style={styles.input}
                placeholder={userProfile?.currency === 'USD' ? 'e.g. 100' : 'e.g. 500000'}
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={targetAmount}
                onChangeText={setTargetAmount}
              />
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddGoal}>
                <Text style={styles.submitBtnText}>Create Goal</Text>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        )}

        {loading && !isAdding ? (
          <ActivityIndicator size="large" color="#6643FF" style={{ marginTop: 40 }} />
        ) : goals.length === 0 ? (
          <Text style={styles.emptyText}>No savings goals yet. Create one!</Text>
        ) : (
          <FlatList
            data={goals}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Add Funds Modal */}
      <Modal
        visible={fundingGoal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setFundingGoal(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFundingGoal(null)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Tabungan</Text>
              <TouchableOpacity onPress={() => setFundingGoal(null)}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Masukkan nominal dana untuk tabungan: {fundingGoal?.goalName}
            </Text>
            
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>{userProfile?.currency === 'USD' ? '$' : 'Rp'}</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder={userProfile?.currency === 'USD' ? 'e.g. 10' : 'e.g. 50000'}
                placeholderTextColor="#555566"
                value={fundingAmount}
                onChangeText={setFundingAmount}
                autoFocus
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancel} 
                onPress={() => {
                  setFundingGoal(null);
                  setFundingAmount('');
                }}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalSave} 
                onPress={handleConfirmAddFunds}
                disabled={fundingLoading}
              >
                <Text style={styles.modalSaveText}>
                  {fundingLoading ? 'Menyimpan...' : 'Tambah'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
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
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 50,
    fontSize: 16,
  },
  addGoalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  label: {
    color: '#A0A0A0',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#6643FF',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  percentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00E676',
  },
  amounts: {
    color: '#A0A0A0',
    marginBottom: 16,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6643FF',
    borderRadius: 4,
  },
  addFundsBtn: {
    backgroundColor: 'rgba(102, 67, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#6643FF',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFundsText: {
    color: '#6643FF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: 'rgba(25, 25, 35, 0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#A0A0B0',
    marginBottom: 20,
    lineHeight: 20,
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
  currencyPrefix: {
    color: '#6643FF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#E0E0E0',
    fontWeight: '600',
    fontSize: 14,
  },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#6643FF',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
