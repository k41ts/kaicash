import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Dimensions, Modal, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { Transaction, UserProfile } from '../../types';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatCurrency } from '../../utils/formatCurrency';
import { fetchChildrenProfiles } from '../../services/familyService';
import { BlurView } from 'expo-blur';

const screenWidth = Dimensions.get('window').width;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

// Helper for Indonesian Day Names
const getIndonesianDayName = (date: Date): string => {
  const dayIndex = date.getDay();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[dayIndex];
};

export default function ParentHistoryScreen() {
  const user = useAuthStore((state) => state.user);
  const selectedChildId = useAuthStore((state) => state.selectedChildId);
  const setSelectedChildId = useAuthStore((state) => state.setSelectedChildId);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState<UserProfile[]>([]);
  const [activeChild, setActiveChild] = useState<UserProfile | null>(null);
  const [childModalVisible, setChildModalVisible] = useState(false);

  // Raw transactions
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  // History filter: 'all' | 'weekly' | 'monthly'
  const [filterMode, setFilterMode] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Collapsible states
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [expandedMonthlyDays, setExpandedMonthlyDays] = useState<Record<string, boolean>>({});

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
            // 4. Fetch all transactions for active child
            const txRef = collection(db, 'transactions');
            const qTx = query(txRef, where('childId', '==', currentActiveId));
            const txSnap = await getDocs(qTx);

            const allTx: Transaction[] = [];
            txSnap.forEach((document) => {
              const t = document.data() as Transaction;
              // Only include spending/expenses (amount > 0)
              if (t.amount > 0) {
                allTx.push(t);
              }
            });

            // Sort transactions by date descending
            allTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setAllTransactions(allTx);
          }
        } else {
          setChildren([]);
          setActiveChild(null);
          setAllTransactions([]);
        }
      } else {
        setChildren([]);
        setActiveChild(null);
        setAllTransactions([]);
      }
    } catch (error) {
      console.error('Error loading history data:', error);
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

  const handleSelectChild = (childId: string) => {
    setSelectedChildId(childId);
    setChildModalVisible(false);
  };

  const toggleDayExpansion = (dayKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  const toggleMonthExpansion = (monthKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const toggleMonthlyDayExpansion = (dayKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMonthlyDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  // ==========================================
  // GROUPING LOGIC FOR WEEKLY HISTORY
  // ==========================================
  const getWeeklyHistoryData = () => {
    const now = new Date();
    const startOfWeekDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday

    // Generate the 7 days of the current week
    const days = [];
    let currentDay = new Date(startOfWeekDate);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return days.map((dayDate) => {
      const dayTxs = allTransactions.filter((tx) => isSameDay(new Date(tx.date), dayDate));
      const totalAmount = dayTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const dayName = getIndonesianDayName(dayDate);
      const formattedDateStr = `${dayName}, ${format(dayDate, 'dd MMM yyyy')}`;
      const dayKey = format(dayDate, 'yyyy-MM-dd');

      return {
        key: dayKey,
        date: dayDate,
        formattedDate: formattedDateStr,
        totalAmount,
        transactions: dayTxs,
      };
    })
    .filter((dayGroup) => dayGroup.transactions.length > 0) // ONLY show days that have transactions!
    .reverse(); // Show latest days first
  };

  // ==========================================
  // GROUPING LOGIC FOR MONTHLY HISTORY
  // ==========================================
  const getMonthlyHistoryData = () => {
    // Group transactions by month key "yyyy-MM" (e.g. "2026-06")
    const monthsMap: Record<string, {
      monthDate: Date;
      formattedMonth: string; // e.g. "Juni 2026"
      totalAmount: number;
      daysMap: Record<string, {
        date: Date;
        formattedDate: string; // e.g. "Rabu, 24 Jun 2026"
        totalAmount: number;
        transactions: Transaction[];
      }>;
    }> = {};

    allTransactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      const monthKey = format(txDate, 'yyyy-MM');
      const dayKey = format(txDate, 'yyyy-MM-dd');

      // Initialize month group
      if (!monthsMap[monthKey]) {
        // Simple manual formatting to ensure Indonesian month names
        const monthIndex = txDate.getMonth();
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const monthNameIndo = `${monthNames[monthIndex]} ${txDate.getFullYear()}`;

        monthsMap[monthKey] = {
          monthDate: txDate,
          formattedMonth: monthNameIndo,
          totalAmount: 0,
          daysMap: {},
        };
      }

      // Initialize day group inside month
      if (!monthsMap[monthKey].daysMap[dayKey]) {
        const dayName = getIndonesianDayName(txDate);
        monthsMap[monthKey].daysMap[dayKey] = {
          date: txDate,
          formattedDate: `${dayName}, ${format(txDate, 'dd MMM yyyy')}`,
          totalAmount: 0,
          transactions: [],
        };
      }

      // Add transaction and amount
      monthsMap[monthKey].totalAmount += tx.amount;
      monthsMap[monthKey].daysMap[dayKey].totalAmount += tx.amount;
      monthsMap[monthKey].daysMap[dayKey].transactions.push(tx);
    });

    // Convert months map to sorted array
    return Object.keys(monthsMap)
      .map((mKey) => {
        const mData = monthsMap[mKey];
        
        // Convert days map to sorted array (latest day first)
        const days = Object.keys(mData.daysMap)
          .map((dKey) => {
            const dData = mData.daysMap[dKey];
            return {
              key: dKey,
              date: dData.date,
              formattedDate: dData.formattedDate,
              totalAmount: dData.totalAmount,
              transactions: dData.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            };
          })
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        return {
          key: mKey,
          label: mData.formattedMonth,
          totalAmount: mData.totalAmount,
          days,
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key)); // Sort months descending
  };

  const renderDropdown = () => (
    <Modal
      visible={dropdownVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setDropdownVisible(false)}
    >
      <TouchableOpacity
        style={styles.dropdownOverlay}
        activeOpacity={1}
        onPress={() => setDropdownVisible(false)}
      >
        <BlurView intensity={30} tint="dark" style={styles.dropdownContent}>
          <TouchableOpacity
            style={[styles.dropdownItem, filterMode === 'all' && styles.dropdownItemActive]}
            onPress={() => {
              setFilterMode('all');
              setDropdownVisible(false);
            }}
          >
            <Feather name="list" size={16} color={filterMode === 'all' ? '#A28BFF' : '#FFF'} style={{ marginRight: 10 }} />
            <Text style={[styles.dropdownText, filterMode === 'all' && styles.dropdownTextActive]}>Semua History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dropdownItem, filterMode === 'weekly' && styles.dropdownItemActive]}
            onPress={() => {
              setFilterMode('weekly');
              setDropdownVisible(false);
            }}
          >
            <Feather name="calendar" size={16} color={filterMode === 'weekly' ? '#A28BFF' : '#FFF'} style={{ marginRight: 10 }} />
            <Text style={[styles.dropdownText, filterMode === 'weekly' && styles.dropdownTextActive]}>History Mingguan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dropdownItem, filterMode === 'monthly' && styles.dropdownItemActive]}
            onPress={() => {
              setFilterMode('monthly');
              setDropdownVisible(false);
            }}
          >
            <Feather name="clock" size={16} color={filterMode === 'monthly' ? '#A28BFF' : '#FFF'} style={{ marginRight: 10 }} />
            <Text style={[styles.dropdownText, filterMode === 'monthly' && styles.dropdownTextActive]}>History Bulanan</Text>
          </TouchableOpacity>
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <LinearGradient
      colors={['#050508', '#0A0C22', '#0E0A24', '#050508']}
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
        {/* Header */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
          <Text style={styles.headerTitle}>History</Text>
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
            <Text style={styles.emptySubtitle}>Buka menu Settings untuk menghubungkan akun anak Anda.</Text>
          </BlurView>
        ) : (
          <>
            {/* Dropdown Mode Trigger Button */}
            <View style={styles.filterRow}>
              <BlurView intensity={20} tint="dark" style={styles.modeSelectorWrapper}>
                <TouchableOpacity
                  style={styles.modeSelector}
                  onPress={() => setDropdownVisible(true)}
                >
                  <Feather
                    name={
                      filterMode === 'all'
                        ? 'list'
                        : filterMode === 'weekly'
                        ? 'calendar'
                        : 'clock'
                    }
                    size={16}
                    color="#A28BFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.modeSelectorText}>
                    {filterMode === 'all'
                      ? 'Semua History'
                      : filterMode === 'weekly'
                      ? 'History Mingguan'
                      : 'History Bulanan'}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#FFF" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </BlurView>
            </View>

            {renderDropdown()}

            {/* ======================================================= */}
            {/* VIEW MODE 1: ALL HISTORY                                */}
            {/* ======================================================= */}
            {filterMode === 'all' && (
              <Animated.View entering={FadeInDown.delay(100).duration(800)}>
                {allTransactions.length === 0 ? (
                  <BlurView intensity={15} tint="dark" style={styles.emptyHistoryCardWrapper}>
                    <View style={styles.emptyHistoryCard}>
                      <Feather name="activity" size={36} color="#444" style={{ marginBottom: 12 }} />
                      <Text style={styles.emptyText}>Belum ada riwayat transaksi pengeluaran.</Text>
                    </View>
                  </BlurView>
                ) : (
                  allTransactions.map((tx) => (
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
                          <View style={{ flex: 1 }}>
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
            )}

            {/* ======================================================= */}
            {/* VIEW MODE 2: WEEKLY HISTORY (ONLY DAYS WITH TRANSACTIONS)*/}
            {/* ======================================================= */}
            {filterMode === 'weekly' && (
              <Animated.View entering={FadeInDown.delay(100).duration(800)}>
                {getWeeklyHistoryData().length === 0 ? (
                  <BlurView intensity={15} tint="dark" style={styles.emptyHistoryCardWrapper}>
                    <View style={styles.emptyHistoryCard}>
                      <Feather name="calendar" size={36} color="#444" style={{ marginBottom: 12 }} />
                      <Text style={styles.emptyText}>Tidak ada pengeluaran pada minggu ini.</Text>
                    </View>
                  </BlurView>
                ) : (
                  getWeeklyHistoryData().map((dayGroup) => {
                    const isExpanded = expandedDays[dayGroup.key] || false;

                    return (
                      <BlurView key={dayGroup.key} intensity={15} tint="dark" style={styles.collapsibleCardWrapper}>
                        <TouchableOpacity
                          style={styles.collapsibleHeader}
                          activeOpacity={0.8}
                          onPress={() => toggleDayExpansion(dayGroup.key)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.collapsibleTitle}>{dayGroup.formattedDate}</Text>
                            <Text style={styles.collapsibleSubtitle}>
                              Total Pengeluaran: <Text style={styles.totalAmountHighlight}>{formatCurrency(dayGroup.totalAmount, activeChild?.currency)}</Text>
                            </Text>
                          </View>
                          <Feather
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#A28BFF"
                          />
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.collapsibleContent}>
                            <View style={styles.divider} />
                            {dayGroup.transactions.map((tx) => (
                              <View key={tx.id} style={styles.nestedTxItem}>
                                <View style={styles.nestedTxLeft}>
                                  <View
                                    style={[
                                      styles.nestedTxIconContainer,
                                      { backgroundColor: categoryColors[tx.category] || '#333' },
                                    ]}
                                  >
                                    <Ionicons
                                      name={(categoryIcons[tx.category] as any) || 'cart-outline'}
                                      size={14}
                                      color="#FFF"
                                    />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.nestedTxName} numberOfLines={1}>{tx.expenseName}</Text>
                                    <Text style={styles.nestedTxCategory}>{tx.category} • {format(new Date(tx.date), 'HH:mm')}</Text>
                                  </View>
                                </View>
                                <Text style={styles.nestedTxAmount}>
                                  -{formatCurrency(tx.amount, activeChild?.currency)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </BlurView>
                    );
                  })
                )}
              </Animated.View>
            )}

            {/* ======================================================= */}
            {/* VIEW MODE 3: MONTHLY HISTORY (COLLAPSED BY MONTH)       */}
            {/* ======================================================= */}
            {filterMode === 'monthly' && (
              <Animated.View entering={FadeInDown.delay(100).duration(800)}>
                {getMonthlyHistoryData().length === 0 ? (
                  <BlurView intensity={15} tint="dark" style={styles.emptyHistoryCardWrapper}>
                    <View style={styles.emptyHistoryCard}>
                      <Feather name="clock" size={36} color="#444" style={{ marginBottom: 12 }} />
                      <Text style={styles.emptyText}>Tidak ada riwayat pengeluaran bulanan.</Text>
                    </View>
                  </BlurView>
                ) : (
                  getMonthlyHistoryData().map((monthGroup) => {
                    const isMonthExpanded = expandedMonths[monthGroup.key] || false;

                    return (
                      <BlurView key={monthGroup.key} intensity={15} tint="dark" style={styles.collapsibleCardWrapper}>
                        <TouchableOpacity
                          style={styles.collapsibleHeader}
                          activeOpacity={0.8}
                          onPress={() => toggleMonthExpansion(monthGroup.key)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.collapsibleTitle}>{monthGroup.label}</Text>
                            <Text style={styles.collapsibleSubtitle}>
                              Total Pengeluaran: <Text style={styles.totalAmountHighlight}>{formatCurrency(monthGroup.totalAmount, activeChild?.currency)}</Text>
                            </Text>
                          </View>
                          <Feather
                            name={isMonthExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#A28BFF"
                          />
                        </TouchableOpacity>

                        {isMonthExpanded && (
                          <View style={styles.collapsibleContent}>
                            <View style={styles.divider} />
                            
                            {monthGroup.days.map((dayGroup) => {
                              const isDayExpanded = expandedMonthlyDays[dayGroup.key] || false;

                              return (
                                <View key={dayGroup.key} style={styles.monthlyDayItem}>
                                  <TouchableOpacity
                                    style={styles.monthlyDayHeader}
                                    activeOpacity={0.8}
                                    onPress={() => toggleMonthlyDayExpansion(dayGroup.key)}
                                  >
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.monthlyDayTitle}>{dayGroup.formattedDate}</Text>
                                      <Text style={styles.monthlyDayTotal}>
                                        Total: {formatCurrency(dayGroup.totalAmount, activeChild?.currency)}
                                      </Text>
                                    </View>
                                    <Feather
                                      name={isDayExpanded ? 'chevron-up' : 'chevron-down'}
                                      size={16}
                                      color="#FFF"
                                    />
                                  </TouchableOpacity>

                                  {isDayExpanded && (
                                    <View style={styles.monthlyDayContent}>
                                      {dayGroup.transactions.map((tx) => (
                                        <View key={tx.id} style={styles.nestedTxItem}>
                                          <View style={styles.nestedTxLeft}>
                                            <View
                                              style={[
                                                styles.nestedTxIconContainer,
                                                { backgroundColor: categoryColors[tx.category] || '#333' },
                                              ]}
                                            >
                                              <Ionicons
                                                name={(categoryIcons[tx.category] as any) || 'cart-outline'}
                                                size={12}
                                                color="#FFF"
                                              />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                              <Text style={styles.nestedTxName} numberOfLines={1}>{tx.expenseName}</Text>
                                              <Text style={styles.nestedTxCategory}>{tx.category} • {format(new Date(tx.date), 'HH:mm')}</Text>
                                            </View>
                                          </View>
                                          <Text style={styles.nestedTxAmount}>
                                            -{formatCurrency(tx.amount, activeChild?.currency)}
                                          </Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                  <View style={styles.subDivider} />
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </BlurView>
                    );
                  })
                )}
              </Animated.View>
            )}
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
  // Filter row & dropdown trigger
  filterRow: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'flex-start',
  },
  modeSelectorWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modeSelectorText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Dropdown overlay & items
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContent: {
    width: screenWidth - 64,
    backgroundColor: '#0F0F14',
    borderRadius: 24,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(102, 67, 255, 0.1)',
  },
  dropdownText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownTextActive: {
    color: '#A28BFF',
  },
  // Transaction Cards (Semua History)
  emptyHistoryCardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyHistoryCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  emptyText: {
    color: '#A0A0B4',
    fontSize: 14,
    textAlign: 'center',
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
  // Collapsible cards (Weekly/Monthly)
  collapsibleCardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 14,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  collapsibleTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  collapsibleSubtitle: {
    color: '#A0A0B4',
    fontSize: 13,
  },
  totalAmountHighlight: {
    color: '#FFCC00',
    fontWeight: '700',
  },
  noTxLabel: {
    color: '#555566',
    fontSize: 12,
    fontWeight: '600',
  },
  collapsibleContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },
  // Nested item in accordion
  nestedTxItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  nestedTxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  nestedTxIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  nestedTxName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  nestedTxCategory: {
    color: '#888899',
    fontSize: 11,
  },
  nestedTxAmount: {
    color: '#FF5252',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Monthly day items
  monthlyDayItem: {
    marginBottom: 10,
  },
  monthlyDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  monthlyDayTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  monthlyDayTotal: {
    color: '#FFCC00',
    fontSize: 12,
    fontWeight: '600',
  },
  monthlyDayContent: {
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  subDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: 8,
  },
  // Modal Switcher (same as other screens)
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
