import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns';

import { useAuthStore } from '../../store/authStore';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { Transaction, AppNotification } from '../../types';
import { formatCurrency } from '../../utils/formatCurrency';

const screenWidth = Dimensions.get('window').width;

const categoryColors: Record<string, string> = {
  'Food': '#FF3B30',          // Vibrant Red
  'Transportation': '#007AFF',  // Vibrant Blue
  'Internet': '#8E44AD',        // Rich Purple
  'Education': '#FFCC00',       // Bright Yellow (Gold)
  'Entertainment': '#FF2D55',   // Vibrant Pink
  'Health': '#34C759',          // Vibrant Green
  'Shopping': '#00C7BE',        // Vibrant Teal
  'Others': '#8E8E93',          // Neutral Grey
};

const categoryIcons: Record<string, string> = {
  'Food': 'fast-food-outline',
  'Transportation': 'bus-outline',
  'Internet': 'wifi-outline',
  'Education': 'book-outline',
  'Entertainment': 'game-controller-outline',
  'Health': 'heart-outline',
  'Shopping': 'cart-outline',
  'Others': 'options-outline',
};

interface AnimatedBalanceCardProps {
  balance: number;
  currency?: string;
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
  navigation: any;
  setNewBalanceInput: (val: string) => void;
  setIsEditModalVisible: (visible: boolean) => void;
}

function AnimatedBalanceCard({
  balance,
  currency,
  showBalance,
  setShowBalance,
  navigation,
  setNewBalanceInput,
  setIsEditModalVisible,
}: AnimatedBalanceCardProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => (t + 0.015) % (Math.PI * 2)); // Very slow and premium rotation
    }, 40); // 25 FPS
    return () => clearInterval(interval);
  }, []);

  // Smoothly morph the start and end coordinates independently to create a fluid, liquid shimmer
  const x1 = 0.0 + Math.sin(tick * 0.7) * 0.12;
  const y1 = 0.0 + Math.cos(tick * 0.5) * 0.12;
  const x2 = 1.0 + Math.cos(tick * 0.9) * 0.2;
  const y2 = 1.0 + Math.sin(tick * 0.6) * 0.2;

  const color1 = '#161622'; // Dark charcoal base
  const color2 = '#1426AC'; // Rich indigo-blue
  const color3 = '#2C3EC4'; // Vibrant intermediate blue to bridge the transition smoothly
  const color4 = '#94A6FF'; // Soft, glowing lavender-white highlight (no harsh line!)

  return (
    <BlurView intensity={30} tint="dark" style={styles.balanceCardWrapper}>
      <LinearGradient
        colors={[color1, color2, color3, color4]}
        locations={[0, 0.45, 0.75, 1.0]}
        start={{ x: x1, y: y1 }}
        end={{ x: x2, y: y2 }}
        style={styles.balanceCard}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Total balance</Text>
          <TouchableOpacity onPress={() => setShowBalance(!showBalance)} style={styles.eyeIcon}>
            <Feather name={showBalance ? "eye" : "eye-off"} size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceAmount}>
          {showBalance ? formatCurrency(balance, currency) : '••••••'}
        </Text>

        {/* Action Buttons Row inside the card */}
        <View style={styles.actionRow}>
          <View style={styles.actionItem}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('AddExpense')}>
              <Feather name="plus" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionText}>Tambah</Text>
          </View>
          <View style={styles.actionItem}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('History')}>
              <Feather name="list" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionText}>Riwayat</Text>
          </View>
          <View style={styles.actionItem}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Savings')}>
              <Feather name="award" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionText}>Tabungan</Text>
          </View>
          <View style={styles.actionItem}>
            <TouchableOpacity style={styles.actionButton} onPress={() => {
              setNewBalanceInput(balance.toString());
              setIsEditModalVisible(true);
            }}>
              <Feather name="edit-2" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionText}>Ubah Saldo</Text>
          </View>
        </View>
      </LinearGradient>
    </BlurView>
  );
}

export default function ChildDashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const userProfile = useAuthStore((state) => state.userProfile);
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  const [balance, setBalance] = useState(0);
  const [totalOutState, setTotalOutState] = useState(0);
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [spendingData, setSpendingData] = useState<any[]>([]);
  const [weeklySpendingData, setWeeklySpendingData] = useState<number[]>([0, 0, 0, 0]);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [weeklySpending, setWeeklySpending] = useState(0);
  const [weeklySpendingDataPie, setWeeklySpendingDataPie] = useState<any[]>([]);
  const [spendingPeriod, setSpendingPeriod] = useState<'week' | 'month'>('week');

  // Edit Balance State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

  // Notifications states
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const notifRef = collection(db, 'notifications');
      const qNotif = query(notifRef, where('userId', '==', user.uid));
      const snap = await getDocs(qNotif);
      const list: AppNotification[] = [];
      let unread = 0;
      snap.forEach(docSnap => {
        const n = docSnap.data() as AppNotification;
        list.push(n);
        if (!n.isRead) unread++;
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(list);
      setUnreadCount(unread);
    } catch (e) {
      console.error("Error fetching notifications:", e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.isRead);
      const promises = unreadNotifs.map(n => updateDoc(doc(db, 'notifications', n.id), { isRead: true }));
      await Promise.all(promises);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Error marking all read:", e);
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const oneDayMs = 24 * 60 * 60 * 1000;
      const oneWeekMs = 7 * oneDayMs;

      const txRef = collection(db, 'transactions');
      const qTx = query(txRef, where('childId', '==', user.uid));
      const txSnap = await getDocs(qTx);

      let totalSpent = 0;
      let totalOut = 0;
      let currentWeekSpent = 0;

      const monthlyCategoryTotals: Record<string, number> = {};
      const weeklyCategoryTotals: Record<string, number> = {};
      const allTx: Transaction[] = [];

      txSnap.forEach(document => {
        const data = document.data() as Transaction;
        allTx.push(data);
        totalOut += data.amount;

        const txDate = new Date(data.date);
        const txTime = txDate.getTime();
        const diffMs = now.getTime() - txTime;

        // Monthly spending & categories
        if (isWithinInterval(txDate, { start: monthStart, end: monthEnd })) {
          if (data.amount > 0) {
            totalSpent += data.amount;
            monthlyCategoryTotals[data.category] = (monthlyCategoryTotals[data.category] || 0) + data.amount;
          }
        }

        // Weekly spending & categories (last 7 days, allowing 30 min future drift)
        if (data.amount > 0 && diffMs >= -1800000 && diffMs < oneWeekMs) {
          currentWeekSpent += data.amount;
          weeklyCategoryTotals[data.category] = (weeklyCategoryTotals[data.category] || 0) + data.amount;
        }
      });

      setMonthlySpending(totalSpent);
      setWeeklySpending(currentWeekSpent);
      setTotalOutState(totalOut);

      let bBalance = 0;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        bBalance = userDoc.data().baseBalance || 0;
      }
      setBalance(bBalance - totalOut);

      // Format Monthly Pie data
      const monthlyChartData = Object.keys(monthlyCategoryTotals).map(cat => ({
        name: cat,
        population: monthlyCategoryTotals[cat],
        color: categoryColors[cat] || '#ccc',
        legendFontColor: '#A0A0A0',
        legendFontSize: 12,
      }));
      setSpendingData(monthlyChartData);

      // Format Weekly Pie data
      const weeklyChartData = Object.keys(weeklyCategoryTotals).map(cat => ({
        name: cat,
        population: weeklyCategoryTotals[cat],
        color: categoryColors[cat] || '#ccc',
        legendFontColor: '#A0A0A0',
        legendFontSize: 12,
      }));
      setWeeklySpendingDataPie(weeklyChartData);

      // Sort and get recent
      allTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentTransactions(allTx.slice(0, 5));

      // Calculate weekly spending (last 4 weeks)
      const weeklyTotals = [0, 0, 0, 0];

      allTx.forEach(tx => {
        if (tx.amount > 0) { // Only spending/expenses
          const txTime = new Date(tx.date).getTime();
          const diffMs = now.getTime() - txTime;
          // Allow 30 minutes of future drift
          if (diffMs >= -1800000 && diffMs < 4 * oneWeekMs) {
            const adjustedDiffMs = Math.max(0, diffMs);
            const weekIndex = Math.floor(adjustedDiffMs / oneWeekMs);
            if (weekIndex >= 0 && weekIndex < 4) {
              weeklyTotals[3 - weekIndex] += tx.amount;
            }
          }
        }
      });
      setWeeklySpendingData(weeklyTotals);

      // Focus dailyAverage on the current week (last 7 days, W-0)
      const average = weeklyTotals[3] / 7;
      setDailyAverage(average);

      await fetchNotifications();

    } catch (error) {
      console.error("Error fetching dashboard data: ", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboardData();
    });
    return unsubscribe;
  }, [navigation, user]);

  const handleSaveBalance = async () => {
    if (!newBalanceInput || isNaN(Number(newBalanceInput))) {
      Alert.alert('Error', 'Silakan masukkan nominal angka yang valid.');
      return;
    }

    setSavingBalance(true);
    try {
      const targetBalance = Number(newBalanceInput);
      const newBaseBalance = targetBalance + totalOutState;

      await updateDoc(doc(db, 'users', user!.uid), {
        baseBalance: newBaseBalance
      });

      setBalance(targetBalance);
      setIsEditModalVisible(false);
      setNewBalanceInput('');
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating balance', error);
      Alert.alert('Error', 'Gagal memperbarui saldo.');
    } finally {
      setSavingBalance(false);
    }
  };

  return (
    <LinearGradient
      colors={['#060814', '#0A0E2D', '#070818', '#030308']} // Premium midnight-blue ambient glow background
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Identical to Parent Header */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userProfile?.name?.charAt(0) || 'K'}</Text>
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.greeting}>Halo, Anak</Text>
              <Text style={styles.subtitle}>{userProfile?.name || 'Explorer'}</Text>
            </View>
          </View>
          <BlurView intensity={15} tint="dark" style={styles.notifButtonWrapper}>
            <TouchableOpacity style={styles.notifButton} onPress={() => setNotifModalVisible(true)}>
              <Feather name="bell" size={20} color="#FFF" />
              {unreadCount > 0 && <View style={styles.notifBadge} />}
            </TouchableOpacity>
          </BlurView>
        </Animated.View>

        {/* Premium Balance Card - Redesigned to matches parent style (charcoal to indigo gradient) */}
        <Animated.View entering={FadeInDown.delay(200).duration(800)}>
          <AnimatedBalanceCard
            balance={balance}
            currency={userProfile?.currency}
            showBalance={showBalance}
            setShowBalance={setShowBalance}
            navigation={navigation}
            setNewBalanceInput={setNewBalanceInput}
            setIsEditModalVisible={setIsEditModalVisible}
          />
        </Animated.View>

        {/* Custom Doughnut Chart Spending Analysis Card - Exact Match to Parent */}
        <Animated.View entering={FadeInDown.delay(300).duration(800)}>
          <BlurView intensity={20} tint="dark" style={styles.analysisCardWrapper}>
            <View style={styles.analysisCard}>
              {/* Top Row: Title and spacious Period Toggle */}
              <View style={styles.cardHeaderRow}>
                <Text style={styles.analysisLabel}>
                  {spendingPeriod === 'week' ? 'Belanja Minggu Ini' : 'Belanja Bulan Ini'}
                </Text>

                {/* Period Toggle */}
                <View style={styles.periodToggleRow}>
                  <TouchableOpacity
                    style={[styles.periodToggleBtn, spendingPeriod === 'week' && styles.periodToggleBtnActive]}
                    onPress={() => setSpendingPeriod('week')}
                  >
                    <Text style={[styles.periodToggleText, spendingPeriod === 'week' && styles.periodToggleTextActive]}>Minggu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.periodToggleBtn, spendingPeriod === 'month' && styles.periodToggleBtnActive]}
                    onPress={() => setSpendingPeriod('month')}
                  >
                    <Text style={[styles.periodToggleText, spendingPeriod === 'month' && styles.periodToggleTextActive]}>Bulan</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bottom Row: Amount, Badge and Pie Chart */}
              <View style={styles.cardBodyRow}>
                <View style={styles.analysisLeft}>
                  <Text style={styles.analysisAmount}>
                    {formatCurrency(spendingPeriod === 'week' ? weeklySpending : monthlySpending, userProfile?.currency)}
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      😎 {(spendingPeriod === 'week' ? weeklySpendingDataPie : spendingData).length} Kategori Belanja
                    </Text>
                  </View>
                </View>

                {/* Doughnut Chart Masking */}
                <View style={styles.chartWrapper}>
                  {(spendingPeriod === 'week' ? weeklySpendingDataPie : spendingData).length > 0 ? (
                    <>
                      <PieChart
                        data={spendingPeriod === 'week' ? weeklySpendingDataPie : spendingData}
                        width={100}
                        height={100}
                        chartConfig={{
                          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        }}
                        accessor={"population"}
                        backgroundColor={"transparent"}
                        paddingLeft={"24"}
                        hasLegend={false}
                        absolute
                      />
                      {/* Center mask matching the blur background color to make it look like a doughnut */}
                      <View style={styles.chartCenterMask} />
                    </>
                  ) : (
                    <View style={styles.emptyChartCircle}>
                      <Feather name="activity" size={20} color="#444" />
                    </View>
                  )}
                </View>
              </View>
            </View>
          </BlurView>
        </Animated.View>

        {/* Weekly Spending Bar Chart Card */}
        <Animated.View entering={FadeInDown.delay(350).duration(800)}>
          <BlurView intensity={20} tint="dark" style={styles.analysisCardWrapper}>
            <View style={styles.weeklyCard}>
              <View style={styles.weeklyHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.analysisLabel}>Rata-rata Harian</Text>
                  <Text style={styles.weeklyAverageText}>
                    {formatCurrency(dailyAverage, userProfile?.currency)}
                  </Text>
                </View>
                <View style={styles.chartTitleContainer}>
                  <Text style={styles.chartTitleSub}>Analisis Mingguan</Text>
                </View>
              </View>

              <View style={styles.barChartContainer}>
                <BarChart
                  data={{
                    labels: ['W-3', 'W-2', 'W-1', 'W-0'],
                    datasets: [
                      {
                        data: weeklySpendingData.map(val => {
                          const dailyAvg = val / 7;
                          return userProfile?.currency === 'USD' ? dailyAvg : dailyAvg / 1000;
                        })
                      }
                    ]
                  }}
                  width={screenWidth - 72}
                  height={175}
                  yAxisLabel=""
                  yAxisSuffix={userProfile?.currency === 'USD' ? '' : 'k'}
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: 'rgba(25, 25, 35, 0)',
                    backgroundGradientTo: 'rgba(25, 25, 35, 0)',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(102, 67, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(160, 160, 176, ${opacity})`,
                    propsForBackgroundLines: {
                      strokeDasharray: '',
                      stroke: 'rgba(255, 255, 255, 0.05)'
                    },
                    propsForLabels: {
                      fontSize: 10,
                      fontWeight: '600'
                    },
                    barPercentage: 0.55,
                    fillShadowGradientFrom: '#6643FF',
                    fillShadowGradientTo: '#007AFF',
                    fillShadowGradientOpacity: 1,
                    fillShadowGradientFromOpacity: 1,
                    fillShadowGradientToOpacity: 0.2,
                  }}
                  style={{
                    marginTop: 0,
                    marginBottom: 0,
                    borderRadius: 16,
                    paddingRight: 0,
                    alignSelf: 'center',
                  }}
                  verticalLabelRotation={0}
                  showBarTops={false}
                  withInnerLines={true}
                />
              </View>
            </View>
          </BlurView>
        </Animated.View>

        {/* Recent Transactions List */}
        <Animated.View entering={FadeInDown.delay(400).duration(800)}>
          <Text style={styles.sectionTitle}>Aktivitas Terbaru</Text>

          {recentTransactions.length === 0 ? (
            <BlurView intensity={15} tint="dark" style={styles.noTxCardWrapper}>
              <View style={styles.noTxCard}>
                <Feather name="activity" size={32} color="#444" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>Belum ada riwayat transaksi.</Text>
              </View>
            </BlurView>
          ) : (
            recentTransactions.map(tx => (
              <BlurView key={tx.id} intensity={15} tint="dark" style={styles.txCardWrapper}>
                <View style={styles.txCard}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txIconContainer, { backgroundColor: categoryColors[tx.category] || '#333' }]}>
                      <Ionicons
                        name={(categoryIcons[tx.category] as any) || 'cart-outline'}
                        size={18}
                        color="#FFF"
                      />
                    </View>
                    <View>
                      <Text style={styles.txName} numberOfLines={1}>{tx.expenseName}</Text>
                      <Text style={styles.txDate}>
                        {format(new Date(tx.date), 'dd MMM yyyy - HH:mm')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, tx.amount < 0 && { color: '#00E676' }]}>
                      {tx.amount < 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), userProfile?.currency)}
                    </Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.txCategory}>{tx.category}</Text>
                    </View>
                  </View>
                </View>
              </BlurView>
            ))
          )}
        </Animated.View>

        {/* Edit Balance Modal */}
        <Modal
          visible={isEditModalVisible}
          transparent
          animationType="none"
          onRequestClose={() => setIsEditModalVisible(false)}
        >
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(250)}
            style={styles.centeredModalOverlay}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setIsEditModalVisible(false)}
            />

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <Animated.View
                entering={FadeInDown.duration(250)}
                exiting={FadeOut.duration(200)}
                style={styles.centeredModalContent}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Set Total Balance</Text>
                  <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                    <Feather name="x" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSubtitle}>Masukkan nominal total uang Anda saat ini secara manual.</Text>

                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>{userProfile?.currency === 'USD' ? '$' : 'Rp'}</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    placeholder={userProfile?.currency === 'USD' ? 'e.g. 20' : 'e.g. 250000'}
                    placeholderTextColor="#555566"
                    value={newBalanceInput}
                    onChangeText={setNewBalanceInput}
                    autoFocus
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => {
                      setIsEditModalVisible(false);
                      setNewBalanceInput('');
                    }}
                  >
                    <Text style={styles.modalCancelText}>Batal</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSave}
                    onPress={handleSaveBalance}
                    disabled={savingBalance}
                  >
                    {savingBalance ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalSaveText}>Simpan</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </Animated.View>
        </Modal>
      </ScrollView>

      {/* Notifications Modal */}
      <Modal
        visible={notifModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setNotifModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifikasi</Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllReadBtn}>
                  <Text style={styles.markAllReadText}>Baca Semua</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setNotifModalVisible(false)} style={{ marginLeft: 16 }}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {notifications.length === 0 ? (
                <View style={styles.emptyNotifContainer}>
                  <Feather name="bell-off" size={40} color="#444" style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyNotifText}>Belum ada notifikasi.</Text>
                </View>
              ) : (
                notifications.map((notif) => (
                  <View
                    key={notif.id}
                    style={[
                      styles.notifItem,
                      !notif.isRead && styles.notifItemUnread
                    ]}
                  >
                    <View style={styles.notifItemHeader}>
                      <Text style={styles.notifItemTitle}>{notif.title}</Text>
                      {!notif.isRead && <View style={styles.notifUnreadDot} />}
                    </View>
                    <Text style={styles.notifItemBody}>{notif.body}</Text>
                    <Text style={styles.notifItemDate}>
                      {new Date(notif.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
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
    paddingHorizontal: 16,
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  greeting: {
    fontSize: 12,
    color: '#A0A0B4',
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 2,
  },
  notifButtonWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  notifButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5252',
  },
  // Balance Card Wrapper for Glassmorphism
  balanceCardWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
  balanceCard: {
    padding: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 4,
  },
  balanceAmount: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionItem: {
    alignItems: 'center',
    flex: 1,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 8,
    fontWeight: '600',
  },
  // Spending Analysis Card
  analysisCardWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 24,
  },
  analysisCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 20,
  },
  weeklyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 20,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weeklyAverageText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  chartTitleContainer: {
    alignItems: 'flex-end',
  },
  chartTitleSub: {
    fontSize: 12,
    color: '#6643FF',
    fontWeight: '600',
  },
  barChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  analysisLeft: {
    flex: 1,
    paddingRight: 10,
  },
  analysisLabel: {
    color: '#A0A0B4',
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '500',
  },
  analysisAmount: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  // Doughnut Chart Container
  chartWrapper: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  chartCenterMask: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0C0F32', // Dark blue tone mask matching the glow background in this position
    position: 'absolute',
  },
  emptyChartCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  noTxCardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  noTxCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  emptyText: {
    color: '#A0A0B4',
    fontSize: 14,
  },
  txCardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 12,
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  txName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  txDate: {
    color: '#A0A0B4',
    fontSize: 12,
  },
  txRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  txAmount: {
    color: '#FF5252',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txCategory: {
    color: '#A0A0A0',
    fontSize: 11,
    fontWeight: '500',
  },
  // Modal Switcher (Mockup style)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F0F14',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '50%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    color: '#182FDD',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 16,
    color: '#FFF',
    fontSize: 18,
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
    backgroundColor: '#1426AC',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalScroll: {
    marginBottom: 10,
  },
  markAllReadBtn: {
    backgroundColor: 'rgba(102, 67, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(102, 67, 255, 0.2)',
  },
  markAllReadText: {
    color: '#6643FF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyNotifContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyNotifText: {
    color: '#88889C',
    fontSize: 14,
  },
  notifItem: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 12,
  },
  notifItemUnread: {
    backgroundColor: 'rgba(102, 67, 255, 0.05)',
    borderColor: 'rgba(102, 67, 255, 0.15)',
  },
  notifItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  notifItemTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  notifUnreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5252',
  },
  notifItemBody: {
    color: '#A0A0B4',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  notifItemDate: {
    color: '#555566',
    fontSize: 11,
    fontWeight: '500',
  },
  periodToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 2,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  periodToggleBtnActive: {
    backgroundColor: '#6643FF',
  },
  periodToggleText: {
    color: '#A0A0B4',
    fontSize: 11,
    fontWeight: '600',
  },
  periodToggleTextActive: {
    color: '#FFF',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
  },
  cardBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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
});
