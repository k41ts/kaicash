import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { useAuthStore } from '../../store/authStore';
import { Transaction } from '../../types';
import { format } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { formatCurrency } from '../../utils/formatCurrency';
import { LinearGradient } from 'expo-linear-gradient';

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

export default function HistoryScreen() {
  const user = useAuthStore((state) => state.user);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const userProfile = useAuthStore((state) => state.userProfile);

  const fetchTransactions = async () => {
    if (!user) return;
    try {
      const txRef = collection(db, 'transactions');
      const q = query(txRef, where('childId', '==', user.uid));
      
      const querySnapshot = await getDocs(q);
      const txs: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        txs.push(doc.data() as Transaction);
      });
      
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setTransactions(txs);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  const formatCurrencyVal = (amount: number) => {
    return formatCurrency(amount, userProfile?.currency);
  };

  const renderItem = ({ item, index }: { item: Transaction, index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(500)} style={styles.txCard}>
      <View style={styles.txLeft}>
        <View style={[styles.txIconContainer, { backgroundColor: categoryColors[item.category] || '#333' }]}>
          <Ionicons name="cart-outline" size={24} color="#FFF" />
        </View>
        <View>
          <Text style={styles.txName}>{item.expenseName}</Text>
          <Text style={styles.txSubtitle}>{item.notes || format(new Date(item.date), 'dd MMM yyyy')}</Text>
        </View>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, item.amount < 0 && {color: '#00E676'}]}>
          {item.amount < 0 ? '+' : '-'}{formatCurrencyVal(Math.abs(item.amount))}
        </Text>
        <Text style={styles.txCategory}>{item.category}</Text>
      </View>
    </Animated.View>
  );

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
            <Feather name="x" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.totalAmount}>{formatCurrencyVal(transactions.reduce((acc, curr) => curr.amount > 0 ? acc + curr.amount : acc, 0))}</Text>
            <Text style={styles.headerSubtitle}>Total Spending</Text>
          </View>
        </View>
        
        {loading ? (
          <ActivityIndicator size="large" color="#6643FF" style={{ marginTop: 50 }} />
        ) : transactions.length === 0 ? (
          <Text style={styles.emptyText}>No transactions found.</Text>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 140 }}
            onRefresh={fetchTransactions}
            refreshing={loading}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingRight: 40, // offset for back button
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 50,
    fontSize: 16,
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  txName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  txSubtitle: {
    color: '#888',
    fontSize: 13,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  txCategory: {
    color: '#888',
    fontSize: 12,
  },
});
