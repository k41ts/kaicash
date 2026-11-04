import { collection, query, where, getDocs, setDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Family, UserProfile } from '../types';

// Simple pairing using a generic code for now (can be improved)
// Assume we have a collection `pairing_codes` or we just search if a child exists by their email.
// Let's use a 6-digit random string as the pairing code, saved in the user's document or a separate collection.

export const generatePairingCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createFamilyAndLink = async (parentId: string, pairingCode: string) => {
  try {
    // 1. Find child by pairingCode
    const usersRef = collection(db, 'users');
    const qChild = query(usersRef, where('pairingCode', '==', pairingCode), where('role', '==', 'Child'));
    const childSnap = await getDocs(qChild);

    if (childSnap.empty) {
      throw new Error('Anak dengan kode pairing tersebut tidak ditemukan.');
    }

    const childDoc = childSnap.docs[0];
    const childId = childDoc.id;

    // 2. Check if family exists for this parent
    const familiesRef = collection(db, 'families');
    const qFam = query(familiesRef, where('parentId', '==', parentId));
    const famSnap = await getDocs(qFam);

    if (famSnap.empty) {
      // Create new family
      const newFamilyRef = doc(collection(db, 'families'));
      const newFamily: Family = {
        id: newFamilyRef.id,
        parentId,
        childIds: [childId]
      };
      await setDoc(newFamilyRef, newFamily);
    } else {
      // Update existing family
      const familyDoc = famSnap.docs[0];
      const familyData = familyDoc.data() as Family;
      if (familyData.childIds && familyData.childIds.includes(childId)) {
        throw new Error('Anak tersebut sudah terhubung dengan akun Anda.');
      }
      await updateDoc(familyDoc.ref, {
        childIds: arrayUnion(childId)
      });
    }

    // Update parentId in child's budget settings if it exists
    const budgetRef = collection(db, 'budget_settings');
    const qBudget = query(budgetRef, where('childId', '==', childId));
    const budgetSnap = await getDocs(qBudget);
    if (!budgetSnap.empty) {
      await updateDoc(doc(db, 'budget_settings', budgetSnap.docs[0].id), {
        parentId: parentId
      });
    }

    return true;
  } catch (error) {
    console.error('Error linking accounts:', error);
    throw error;
  }
};

export const unlinkChild = async (parentId: string, childId: string) => {
  try {
    const familiesRef = collection(db, 'families');
    const q = query(familiesRef, where('parentId', '==', parentId));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const familyDoc = snap.docs[0];
      await updateDoc(familyDoc.ref, {
        childIds: arrayRemove(childId)
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error unlinking child:', error);
    throw error;
  }
};

export const fetchChildrenProfiles = async (childIds: string[]): Promise<UserProfile[]> => {
  if (!childIds || childIds.length === 0) return [];
  try {
    const profiles: UserProfile[] = [];
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('id', 'in', childIds));
    const snap = await getDocs(q);
    snap.forEach(document => {
      profiles.push(document.data() as UserProfile);
    });
    return profiles;
  } catch (error) {
    console.error('Error fetching children profiles:', error);
    return [];
  }
};
