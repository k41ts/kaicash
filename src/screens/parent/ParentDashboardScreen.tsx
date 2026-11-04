import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Dimensions, Modal } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { Transaction, UserProfile, AppNotification } from '../../types';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { formatCurrency } from '../../utils/formatCurrency';
import { fetchChildrenProfiles } from '../../services/familyService';
import { useNavigation } from '@react-navigation/native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { BlurView } from 'expo-blur';

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
}

function AnimatedBalanceCard({ balance, currency, showBalance, setShowBalance, navigation }: AnimatedBalanceCardProps) {
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

        {/* Inner Quick Action Buttons - Perfect mockup match */}
        <View style={styles.actionRow}>
          <View style={styles.actionItem}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Budget')}>
              <Feather name="sliders" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionText}>Batas</Text>
          </View>
          <View style={styles.actionItem}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Analytics')}>
              <Feather name="pie-chart" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionText}>Analisis</Text>
          </View>
          <View style={styles.actionItem}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Link Child')}>
              <Feather name="link-2" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionText}>Link</Text>
          </View>
          <View style={styles.actionItem}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Settings')}>
              <Feather name="settings" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionText}>Pengaturan</Text>
          </View>
        </View>
      </LinearGradient>
    </BlurView>
  );
}

export default function ParentDashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const userProfile = useAuthStore((state) => state.userProfile);
  const selectedChildId = useAuthStore((state) => state.selectedChildId);
  const setSelectedChildId = useAuthStore((state) => state.setSelectedChildId);
  const navigation = useNavigation<any>();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [children, setChildren] = useState<UserProfile[]>([]);
  const [activeChild, setActiveChild] = useState<UserProfile | null>(null);
  const [childTransactions, setChildTransactions] = useState<Transaction[]>([]);
  const [childBalance, setChildBalance] = useState(0);

  // Analytics
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [spendingData, setSpendingData] = useState<any[]>([]);
  const [weeklySpendingData, setWeeklySpendingData] = useState<number[]>([0, 0, 0, 0]);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [weeklySpending, setWeeklySpending] = useState(0);
  const [weeklySpendingDataPie, setWeeklySpendingDataPie] = useState<any[]>([]);
  const [spendingPeriod, setSpendingPeriod] = useState<'week' | 'month'>('week');

  // Toggles and Modals
  const [showBalance, setShowBalance] = useState(true);
  const [childModalVisible, setChildModalVisible] = useState(false);

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
      const { doc, updateDoc } = require('firebase/firestore');
      const unreadNotifs = notifications.filter(n => !n.isRead);
      const promises = unreadNotifs.map(n => updateDoc(doc(db, 'notifications', n.id), { isRead: true }));
      await Promise.all(promises);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Error marking all read:", e);
    }
  };

  const loadData = async (forceRefresh = false) => {
    if (!user) return;
    if (!forceRefresh) setLoading(true);

    try {
      // 1. Fetch family record
      const familyRef = collection(db, 'families');
      const qFam = query(familyRef, where('parentId', '==', user.uid));
      const famSnap = await getDocs(qFam);

      if (!famSnap.empty) {
        const familyData = famSnap.docs[0].data();
        const childIds = familyData.childIds || [];

        if (childIds.length > 0) {
          // 2. Fetch children profiles
          const profiles = await fetchChildrenProfiles(childIds);
          setChildren(profiles);

          // 3. Determine active child ID
          let currentActiveId = selectedChildId;
          if (!currentActiveId || !childIds.includes(currentActiveId)) {
            currentActiveId = childIds[0];
            setSelectedChildId(currentActiveId);
          }

          const activeProfile = profiles.find((p) => p.id === currentActiveId) || null;
          setActiveChild(activeProfile);

          if (currentActiveId) {
            // 4. Fetch transactions for active child
            const txRef = collection(db, 'transactions');
            const qTx = query(txRef, where('childId', '==', currentActiveId));
            const txSnap = await getDocs(qTx);

            const allTx: Transaction[] = [];
            let totalOut = 0;

            let currentMonthSpent = 0;
            let currentWeekSpent = 0;
            const monthlyCategoryTotals: Record<string, number> = {};
            const weeklyCategoryTotals: Record<string, number> = {};

            const now = new Date();
            const monthStart = startOfMonth(now);
            const monthEnd = endOfMonth(now);
            const oneDayMs = 24 * 60 * 60 * 1000;
            const oneWeekMs = 7 * oneDayMs;

            txSnap.forEach((document) => {
              const t = document.data() as Transaction;
              allTx.push(t);
              totalOut += t.amount;

              const txDate = new Date(t.date);
              const txTime = txDate.getTime();
              const diffMs = now.getTime() - txTime;

              // Monthly spending & categories
              if (isWithinInterval(txDate, { start: monthStart, end: monthEnd })) {
                if (t.amount > 0) {
                  currentMonthSpent += t.amount;
                  monthlyCategoryTotals[t.category] = (monthlyCategoryTotals[t.category] || 0) + t.amount;
                }
              }

              // Weekly spending & categories (last 7 days, allowing 30 min future drift)
              if (t.amount > 0 && diffMs >= -1800000 && diffMs < oneWeekMs) {
                currentWeekSpent += t.amount;
                weeklyCategoryTotals[t.category] = (weeklyCategoryTotals[t.category] || 0) + t.amount;
              }
            });

            allTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setChildTransactions(allTx.slice(0, 10));

            // 5. Calculate child balance using baseBalance - totalOut
            const baseBal = activeProfile?.baseBalance || 0;
            setChildBalance(baseBal - totalOut);

            // 6. Set monthly and weekly spending states
            setMonthlySpending(currentMonthSpent);
            setWeeklySpending(currentWeekSpent);

            // Format monthly pie data
            const monthlyChartData = Object.keys(monthlyCategoryTotals).map((cat) => ({
              name: cat,
              population: monthlyCategoryTotals[cat],
              color: categoryColors[cat] || '#ccc',
              legendFontColor: '#A0A0A0',
              legendFontSize: 12,
            }));
            setSpendingData(monthlyChartData);

            // Format weekly pie data
            const weeklyChartData = Object.keys(weeklyCategoryTotals).map((cat) => ({
              name: cat,
              population: weeklyCategoryTotals[cat],
              color: categoryColors[cat] || '#ccc',
              legendFontColor: '#A0A0A0',
              legendFontSize: 12,
            }));
            setWeeklySpendingDataPie(weeklyChartData);

            // Calculate weekly spending (last 4 weeks) for active child
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
          }
        } else {
          setChildren([]);
          setActiveChild(null);
          setChildTransactions([]);
          setChildBalance(0);
          setSelectedChildId(null);
          setMonthlySpending(0);
          setSpendingData([]);
        }
      } else {
        setChildren([]);
        setActiveChild(null);
        setChildTransactions([]);
        setChildBalance(0);
        setSelectedChildId(null);
        setMonthlySpending(0);
        setSpendingData([]);
      }

      await fetchNotifications();
    } catch (error) {
      console.error('Error fetching parent dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [user, selectedChildId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  const handleSelectChild = (childId: string) => {
    setSelectedChildId(childId);
    setChildModalVisible(false);
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Mockup Header - Premium & Sleek */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userProfile?.name?.charAt(0) || 'P'}
              </Text>
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.greeting}>Halo, Ortu</Text>
              <Text style={styles.subtitle}>{userProfile?.name}</Text>
            </View>
          </View>
          <BlurView intensity={15} tint="dark" style={styles.notifButtonWrapper}>
            <TouchableOpacity style={styles.notifButton} onPress={() => setNotifModalVisible(true)}>
              <Feather name="bell" size={20} color="#FFF" />
              {unreadCount > 0 && <View style={styles.notifBadge} />}
            </TouchableOpacity>
          </BlurView>
        </Animated.View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#6643FF" />
          </View>
        ) : children.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(800)}>
            <BlurView intensity={15} tint="dark" style={styles.emptyCardWrapper}>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconContainer}>
                  <Feather name="link-2" size={40} color="#6643FF" />
                </View>
                <Text style={styles.emptyTitle}>Belum Ada Anak Terhubung</Text>
                <Text style={styles.emptySubtitle}>
                  Silakan masuk ke menu 'Link Child' lalu masukkan kode pairing unik yang tertera di menu Settings aplikasi anak Anda.
                </Text>
              </View>
            </BlurView>
          </Animated.View>
        ) : (
          <>
            {/* Mockup 2 Child Selector Row (Pill + Settings) */}
            <View style={styles.selectorRow}>
              <BlurView intensity={20} tint="dark" style={styles.selectorPillWrapper}>
                <TouchableOpacity
                  style={styles.selectorPill}
                  onPress={() => setChildModalVisible(true)}
                >
                  <Feather name="eye" size={16} color="#A0A0B4" style={{ marginRight: 8 }} />
                  <Text style={styles.selectorPillText}>
                    Memantau keuangan: <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{activeChild?.name}</Text>
                  </Text>
                  {children.length > 1 && (
                    <Feather name="chevron-down" size={16} color="#FFF" style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              </BlurView>

              <View style={styles.selectorActions}>
                <BlurView intensity={20} tint="dark" style={styles.selectorIconBtnWrapper}>
                  <TouchableOpacity style={styles.selectorIconBtn} onPress={() => navigation.navigate('Settings')}>
                    <Feather name="settings" size={18} color="#FFF" />
                  </TouchableOpacity>
                </BlurView>
              </View>
            </View>

            {/* Premium Gradient Balance Card - Redesigned to fade from dark charcoal/black to rich glowing blue */}
            <Animated.View entering={FadeInDown.delay(200).duration(800)}>
              <AnimatedBalanceCard
                balance={childBalance}
                currency={activeChild?.currency}
                showBalance={showBalance}
                setShowBalance={setShowBalance}
                navigation={navigation}
              />
            </Animated.View>

            {/* Custom Doughnut Chart Spending Analysis Card - Exact Mockup 2 Styling */}
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
                        {formatCurrency(spendingPeriod === 'week' ? weeklySpending : monthlySpending, activeChild?.currency)}
                      </Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          😎 {(spendingPeriod === 'week' ? weeklySpendingDataPie : spendingData).length} Kategori Belanja
                        </Text>
                      </View>
                    </View>

                    {/* Doughnut Chart Masking Hack */}
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
                        {formatCurrency(dailyAverage, activeChild?.currency)}
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
                              return activeChild?.currency === 'USD' ? dailyAvg : dailyAvg / 1000;
                            })
                          }
                        ]
                      }}
                      width={screenWidth - 72}
                      height={175}
                      yAxisLabel=""
                      yAxisSuffix={activeChild?.currency === 'USD' ? '' : 'k'}
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

            {/* Recent Activity */}
            <Animated.View entering={FadeInDown.delay(400).duration(800)}>
              <Text style={styles.sectionTitle}>Aktivitas Terbaru</Text>

              {childTransactions.length === 0 ? (
                <BlurView intensity={15} tint="dark" style={styles.noTxCardWrapper}>
                  <View style={styles.noTxCard}>
                    <Feather name="activity" size={32} color="#444" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyText}>Belum ada riwayat transaksi.</Text>
                  </View>
                </BlurView>
              ) : (
                childTransactions.map((tx) => (
                  <BlurView key={tx.id} intensity={15} tint="dark" style={styles.txCardWrapper}>
                    <View style={styles.txCard}>
                      <View style={styles.txLeft}>
                        <View
                          style={[
                            styles.txIconContainer,
                            { backgroundColor: categoryColors[tx.category] || '#333' },
                          ]}
                        >
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
                        <Text style={styles.txAmount}>-{formatCurrency(tx.amount, activeChild?.currency)}</Text>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.txCategory}>{tx.category}</Text>
                        </View>
                      </View>
                    </View>
                  </BlurView>
                ))
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Child Switcher Bottom Modal (Triggered by pressing Pill Selector) */}
      <Modal
        visible={childModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setChildModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setChildModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Anak</Text>
              <TouchableOpacity onPress={() => setChildModalVisible(false)}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {children.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.modalChildItem,
                    child.id === activeChild?.id && styles.modalChildItemActive
                  ]}
                  onPress={() => handleSelectChild(child.id)}
                >
                  <View style={styles.modalChildAvatar}>
                    <Text style={styles.modalChildAvatarText}>{child.name.charAt(0)}</Text>
                  </View>
                  <Text style={styles.modalChildName}>{child.name}</Text>
                  {child.id === activeChild?.id && (
                    <Feather name="check" size={20} color="#182FDD" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

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
    paddingTop: 60,
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
  // Child selector row (Mockup 2)
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  selectorPillWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  selectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  selectorPillText: {
    color: '#A0A0B4',
    fontSize: 13,
  },
  selectorActions: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorIconBtnWrapper: {
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  selectorIconBtn: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
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
  // Spending Analysis Card (Mockup 2 side-by-side)
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
  emptyCardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 0,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
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
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#A0A0B0',
    textAlign: 'center',
    lineHeight: 22,
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
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScroll: {
    marginBottom: 10,
  },
  modalChildItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#16161F',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  modalChildItemActive: {
    backgroundColor: 'rgba(24, 47, 221, 0.08)',
    borderColor: 'rgba(24, 47, 221, 0.3)',
  },
  modalChildAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1E24',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalChildAvatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalChildName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
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
});
