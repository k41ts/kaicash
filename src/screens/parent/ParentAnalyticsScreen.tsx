import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions, TouchableOpacity, Modal } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { Transaction, UserProfile } from '../../types';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '../../utils/formatCurrency';
import { useNavigation } from '@react-navigation/native';
import { fetchChildrenProfiles } from '../../services/familyService';
import { Feather, Ionicons } from '@expo/vector-icons';

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

export default function ParentAnalyticsScreen() {
  const user = useAuthStore((state) => state.user);
  const selectedChildId = useAuthStore((state) => state.selectedChildId);
  const setSelectedChildId = useAuthStore((state) => state.setSelectedChildId);
  const navigation = useNavigation<any>();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [children, setChildren] = useState<UserProfile[]>([]);
  const [activeChild, setActiveChild] = useState<UserProfile | null>(null);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [spendingData, setSpendingData] = useState<any[]>([]);

  // Premium Analytics States
  const [totalTxCount, setTotalTxCount] = useState(0);
  const [highestTxAmount, setHighestTxAmount] = useState(0);
  const [highestTxName, setHighestTxName] = useState('');
  const [weeklySpendingData, setWeeklySpendingData] = useState<number[]>([0, 0, 0, 0]);
  const [childModalVisible, setChildModalVisible] = useState(false);

  const fetchAnalyticsData = async (forceRefresh = false) => {
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

          // Get active child ID
          let currentActiveId = selectedChildId;
          if (!currentActiveId || !childIds.includes(currentActiveId)) {
            currentActiveId = childIds[0];
            setSelectedChildId(currentActiveId);
          }

          const activeProfile = profiles.find((p) => p.id === currentActiveId) || null;
          setActiveChild(activeProfile);

          if (currentActiveId) {
            const now = new Date();
            const monthStart = startOfMonth(now);
            const monthEnd = endOfMonth(now);
            const weekStart = startOfWeek(now);
            const weekEnd = endOfWeek(now);

            const txRef = collection(db, 'transactions');
            const qTx = query(txRef, where('childId', '==', currentActiveId));
            const txSnap = await getDocs(qTx);

            let mTotal = 0;
            let wTotal = 0;
            let totalCount = 0;
            let maxTxAmount = 0;
            let maxTxName = '';
            const categoryTotals: Record<string, number> = {};

            const weeklyTotals = [0, 0, 0, 0];
            const oneDayMs = 24 * 60 * 60 * 1000;
            const oneWeekMs = 7 * oneDayMs;

            txSnap.forEach((document) => {
              const t = document.data() as Transaction;
              const txDate = new Date(t.date);

              if (t.amount > 0) { // Only spending
                if (isWithinInterval(txDate, { start: monthStart, end: monthEnd })) {
                  mTotal += t.amount;
                  categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
                  totalCount++;
                  if (t.amount > maxTxAmount) {
                    maxTxAmount = t.amount;
                    maxTxName = t.expenseName;
                  }
                }
                if (isWithinInterval(txDate, { start: weekStart, end: weekEnd })) {
                  wTotal += t.amount;
                }
                // Last 4 weeks
                const diffMs = now.getTime() - txDate.getTime();
                if (diffMs >= 0 && diffMs < 4 * oneWeekMs) {
                  const weekIndex = Math.floor(diffMs / oneWeekMs);
                  if (weekIndex >= 0 && weekIndex < 4) {
                    weeklyTotals[3 - weekIndex] += t.amount;
                  }
                }
              }
            });

            setMonthlyTotal(mTotal);
            setWeeklyTotal(wTotal);
            setTotalTxCount(totalCount);
            setHighestTxAmount(maxTxAmount);
            setHighestTxName(maxTxName);
            setWeeklySpendingData(weeklyTotals);

            const chartData = Object.keys(categoryTotals).map((cat) => ({
              name: cat,
              population: categoryTotals[cat],
              color: categoryColors[cat] || '#ccc',
              legendFontColor: '#A0A0A0',
              legendFontSize: 12,
            }));
            chartData.sort((a, b) => b.population - a.population);
            setSpendingData(chartData);
          }
        } else {
          setChildren([]);
          setActiveChild(null);
          setMonthlyTotal(0);
          setWeeklyTotal(0);
          setSpendingData([]);
          setTotalTxCount(0);
          setHighestTxAmount(0);
          setHighestTxName('');
          setWeeklySpendingData([0, 0, 0, 0]);
        }
      } else {
        setChildren([]);
        setActiveChild(null);
        setMonthlyTotal(0);
        setWeeklyTotal(0);
        setSpendingData([]);
        setTotalTxCount(0);
        setHighestTxAmount(0);
        setHighestTxName('');
        setWeeklySpendingData([0, 0, 0, 0]);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData(true);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [user, selectedChildId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchAnalyticsData();
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
        <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          {activeChild && (
            <TouchableOpacity
              style={styles.childPill}
              onPress={() => setChildModalVisible(true)}
            >
              <View style={styles.childAvatar}>
                <Text style={styles.childAvatarText}>
                  {activeChild.name?.charAt(0) || 'K'}
                </Text>
              </View>
              <Text style={styles.childName}>{activeChild.name}</Text>
              <Feather name="chevron-down" size={14} color="#FFF" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#6643FF" />
          </View>
        ) : !selectedChildId ? (
          <BlurView intensity={25} tint="dark" style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Feather name="link-2" size={40} color="#6643FF" />
            </View>
            <Text style={styles.emptyTitle}>Belum Ada Anak Terhubung</Text>
            <Text style={styles.emptySubtitle}>Go to the Link Child tab to link your child's account.</Text>
          </BlurView>
        ) : (
          <>
            {/* Summary Cards */}
            <Animated.View entering={FadeInDown.delay(100).duration(800)} style={styles.summaryRow}>
              <BlurView intensity={20} tint="dark" style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Minggu Ini</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(weeklyTotal, activeChild?.currency)}</Text>
                <Text style={styles.summarySubtext}>Senin - Minggu</Text>
              </BlurView>
              <BlurView intensity={20} tint="dark" style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Bulan Ini</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(monthlyTotal, activeChild?.currency)}</Text>
                <Text style={styles.summarySubtext}>{totalTxCount} Transaksi</Text>
              </BlurView>
            </Animated.View>

            {/* Monthly Proportional Distribution */}
            <Animated.View entering={FadeInDown.delay(200).duration(800)}>
              <BlurView intensity={20} tint="dark" style={styles.chartCard}>
                <Text style={styles.chartTitle}>Proporsi Pengeluaran Bulanan</Text>
                {spendingData.length > 0 ? (
                  <>
                    <View style={styles.pieContainer}>
                      <PieChart
                        data={spendingData}
                        width={screenWidth - 64}
                        height={180}
                        chartConfig={{
                          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        }}
                        accessor={"population"}
                        backgroundColor={"transparent"}
                        paddingLeft={"15"}
                        hasLegend={true}
                        absolute
                      />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.categoryListContainer}>
                      {spendingData.map((cat) => {
                        const percent = monthlyTotal > 0 ? (cat.population / monthlyTotal) * 100 : 0;
                        return (
                          <View key={cat.name} style={styles.categoryListItem}>
                            <View style={styles.categoryRow}>
                              <View style={styles.categoryNameContainer}>
                                <View style={[styles.categoryColorDot, { backgroundColor: cat.color }]} />
                                <Text style={styles.categoryName}>{cat.name}</Text>
                              </View>
                              <Text style={styles.categoryAmount}>
                                {formatCurrency(cat.population, activeChild?.currency)} ({percent.toFixed(0)}%)
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: cat.color }]} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={styles.noDataWrapper}>
                    <Feather name="bar-chart-2" size={48} color="#444" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyText}>Tidak ada data pengeluaran bulan ini.</Text>
                  </View>
                )}
              </BlurView>
            </Animated.View>

            {/* Weekly Spending Trend */}
            <Animated.View entering={FadeInDown.delay(300).duration(800)} style={{ marginTop: 24 }}>
              <BlurView intensity={20} tint="dark" style={styles.chartCard}>
                <Text style={styles.chartTitle}>Tren Pengeluaran Mingguan</Text>

                <BarChart
                  data={{
                    labels: ['W-3', 'W-2', 'W-1', 'W-0'],
                    datasets: [
                      {
                        data: weeklySpendingData.map(val => activeChild?.currency === 'USD' ? val : val / 1000)
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
              </BlurView>
            </Animated.View>

            {/* Insights Grid */}
            <Text style={styles.sectionTitle}>Ringkasan Analitik</Text>
            <View style={styles.statsGrid}>
              <BlurView intensity={20} tint="dark" style={styles.gridCard}>
                <Feather name="trending-up" size={20} color="#FFAB40" style={{ marginBottom: 8 }} />
                <Text style={styles.gridLabel}>Transaksi Termahal</Text>
                <Text style={styles.gridValue} numberOfLines={1}>
                  {highestTxAmount > 0 ? formatCurrency(highestTxAmount, activeChild?.currency) : 'Rp 0'}
                </Text>
                <Text style={styles.gridSubtext} numberOfLines={1}>
                  {highestTxName || 'Belum ada data'}
                </Text>
              </BlurView>

              <BlurView intensity={20} tint="dark" style={styles.gridCard}>
                <Feather name="credit-card" size={20} color="#00E676" style={{ marginBottom: 8 }} />
                <Text style={styles.gridLabel}>Rata-rata Transaksi</Text>
                <Text style={styles.gridValue}>
                  {totalTxCount > 0 ? formatCurrency(monthlyTotal / totalTxCount, activeChild?.currency) : 'Rp 0'}
                </Text>
                <Text style={styles.gridSubtext}>{totalTxCount} transaksi bulan ini</Text>
              </BlurView>
            </View>
          </>
        )}
      </ScrollView>

      {/* Child Switcher Bottom Modal */}
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
                    child.id === activeChild?.id && styles.modalChildItemActive,
                  ]}
                  onPress={() => handleSelectChild(child.id)}
                >
                  <View style={styles.modalChildAvatar}>
                    <Text style={styles.modalChildAvatarText}>
                      {child.name?.charAt(0) || 'K'}
                    </Text>
                  </View>
                  <Text style={styles.modalChildName}>{child.name}</Text>
                  {child.id === activeChild?.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#182FDD" />
                  )}
                </TouchableOpacity>
              ))}
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
  childPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 67, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(102, 67, 255, 0.3)',
  },
  childAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6643FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  childAvatarText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  childName: {
    color: '#FFF',
    fontSize: 12,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    flex: 1,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  summaryLabel: {
    color: '#A0A0B4',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
  },
  summaryAmount: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  summarySubtext: {
    color: '#66667A',
    fontSize: 11,
    fontWeight: '500',
  },
  chartCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  pieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 16,
    width: '100%',
  },
  categoryListContainer: {
    width: '100%',
  },
  categoryListItem: {
    marginBottom: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryAmount: {
    color: '#A0A0B4',
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  noDataWrapper: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyText: {
    color: '#88889C',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 28,
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  gridLabel: {
    color: '#A0A0B4',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  gridValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gridSubtext: {
    color: '#66667A',
    fontSize: 11,
    fontWeight: '500',
  },
  // Modal Switcher styles
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
});
