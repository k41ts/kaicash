import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, doc, updateDoc, getDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebaseConfig';
import { useAuthStore } from '../../store/authStore';
import { Transaction, BalanceHistory } from '../../types';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '../../utils/formatCurrency';

const CATEGORIES = [
  'Food', 'Transportation', 'Internet', 'Education', 
  'Entertainment', 'Health', 'Shopping', 'Others'
];

export default function AddExpenseScreen() {
  const user = useAuthStore((state) => state.user);
  const navigation = useNavigation();
  
  const [txType, setTxType] = useState<'OUT' | 'IN'>('OUT');
  const [expenseName, setExpenseName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const userProfile = useAuthStore((state) => state.userProfile);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.2, // Very low quality to save Firestore space
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      // Store base64 data URI temporarily
      const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setReceiptUri(base64Uri);
    }
  };

  const handleSubmit = async () => {
    if (!expenseName || !amount) {
      Alert.alert('Validation Error', 'Title and Amount are required.');
      return;
    }

    const cleanAmount = amount.replace(/[^0-9]/g, '');
    const numAmount = parseFloat(cleanAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }

    setLoading(true);

    try {
      const txRef = collection(db, 'transactions');
      const newTxRef = doc(txRef);
      
      // We directly use receiptUri which is now a base64 data URI
      let uploadedReceiptUrl = receiptUri || null;

      // Note: for 'IN' transactions we still save it in transactions to keep it simple, 
      // but maybe with a special category or negative amount.
      // Actually, we can just save it to balance_history to keep it clean.
      // But we will also save it to transactions so it shows up in history.
      const txData: any = {
        id: newTxRef.id,
        childId: user!.uid,
        expenseName, // using same field for income title
        amount: txType === 'OUT' ? numAmount : -numAmount, // trick to separate them or we can add a type field.
        category: txType === 'IN' ? 'Income' : category,
        notes,
        date: new Date().toISOString()
      };

      if (uploadedReceiptUrl) {
        txData.receiptUrl = uploadedReceiptUrl;
      }

      await setDoc(newTxRef, txData as Transaction);

      const balanceHistoryRef = doc(collection(db, 'balance_history'));
      const balanceHistoryData: BalanceHistory = {
        id: balanceHistoryRef.id,
        childId: user!.uid,
        amount: numAmount,
        description: `${txType === 'IN' ? 'Income' : 'Expense'}: ${expenseName}`,
        type: txType,
        date: new Date().toISOString()
      };
      await setDoc(balanceHistoryRef, balanceHistoryData);

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
            title: txType === 'OUT' ? 'Pengeluaran Baru Anak' : 'Pemasukan Baru Anak',
            body: `${userProfile?.name || 'Anak'} mencatat ${txType === 'OUT' ? 'pengeluaran' : 'pemasukan'} "${expenseName}" sebesar ${formatCurrency(numAmount, userProfile?.currency)}`,
            isRead: false,
            createdAt: new Date().toISOString()
          });
        }
      }

      Alert.alert('Success', 'Record saved successfully!');
      
      setExpenseName('');
      setAmount('');
      setCategory(CATEGORIES[0]);
      setNotes('');
      setReceiptUri(null);
      navigation.goBack();

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#050508', '#0A0C22', '#0E0A24', '#050508']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView 
          contentContainerStyle={{ paddingBottom: 140, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="chevron-left" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Record</Text>
        </View>

        <View style={styles.typeToggleContainer}>
          <TouchableOpacity 
            style={[styles.typeButton, txType === 'OUT' && styles.typeButtonExpenseActive]}
            onPress={() => setTxType('OUT')}
          >
            <Text style={[styles.typeButtonText, txType === 'OUT' && {color: '#FFF'}]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeButton, txType === 'IN' && styles.typeButtonIncomeActive]}
            onPress={() => setTxType('IN')}
          >
            <Text style={[styles.typeButtonText, txType === 'IN' && {color: '#FFF'}]}>Income</Text>
          </TouchableOpacity>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={styles.label}>{txType === 'IN' ? 'Where did you get the money from?' : 'What did you buy?'}</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Lunch"
            placeholderTextColor="#666"
            value={expenseName}
            onChangeText={setExpenseName}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Text style={styles.label}>Amount ({userProfile?.currency || 'IDR'})</Text>
          <TextInput
            style={styles.input}
            placeholder={userProfile?.currency === 'USD' ? 'e.g. 10' : 'e.g. 50000'}
            placeholderTextColor="#666"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </Animated.View>

        {txType === 'OUT' && (
          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {txType === 'OUT' && (
          <>
            <Animated.View entering={FadeInDown.delay(400).duration(500)}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Extra details..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(500).duration(500)}>
              <Text style={styles.label}>Receipt Photo (Optional)</Text>
              <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                <Feather name="camera" size={24} color="#3D28E0" />
                <Text style={styles.imageButtonText}>Select Image</Text>
              </TouchableOpacity>
              
              {receiptUri && (
                <Image source={{ uri: receiptUri }} style={styles.previewImage} />
              )}
            </Animated.View>
          </>
        )}

        <Animated.View entering={FadeInDown.delay(600).duration(500)}>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save Expense</Text>}
          </TouchableOpacity>
        </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A0A0A0',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    fontSize: 16,
    color: '#FFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  picker: {
    color: '#FFF',
  },
  imageButton: {
    backgroundColor: 'rgba(61, 40, 224, 0.08)',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(97, 67, 255, 0.3)',
    borderStyle: 'dashed',
    flexDirection: 'row',
  },
  imageButtonText: {
    color: '#6643FF',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
    resizeMode: 'cover',
  },
  submitButton: {
    backgroundColor: '#6643FF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  typeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  typeButtonExpenseActive: {
    backgroundColor: '#FF5252',
  },
  typeButtonIncomeActive: {
    backgroundColor: '#00E676',
  },
  chipsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipActive: {
    backgroundColor: '#6643FF',
    borderColor: '#6643FF',
  },
  chipText: {
    color: '#A0A0A0',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFF',
  },
});
