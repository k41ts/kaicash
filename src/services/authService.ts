import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { Role, UserProfile } from '../types';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export const registerUser = async (email: string, password: string, name: string, role: Role) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userProfile: UserProfile = {
      id: user.uid,
      role,
      email: user.email!,
      name,
      createdAt: new Date().toISOString(),
    };

    if (role === 'Child') {
      userProfile.pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Save profile to Firestore
    await setDoc(doc(db, 'users', user.uid), userProfile);

    return { user, userProfile };
  } catch (error) {
    console.error('Error during registration:', error);
    throw error;
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch user profile
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    let userProfile: UserProfile | null = null;
    
    if (userDoc.exists()) {
      userProfile = userDoc.data() as UserProfile;
    }

    return { user, userProfile };
  } catch (error) {
    console.error('Error during login:', error);
    throw error;
  }
};

export const loginWithGoogle = async (roleIfNew: Role = 'Child') => {
  try {
    // Check if your device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Get the users ID token
    const result = await GoogleSignin.signIn();
    
    if (result.type === 'cancelled') {
      const cancelError = new Error('Sign-in cancelled by user');
      (cancelError as any).code = 'SIGN_IN_CANCELLED';
      throw cancelError;
    }

    const idToken = result.data?.idToken;

    if (!idToken) {
      throw new Error('No ID token found');
    }

    // Create a Google credential with the token
    const googleCredential = GoogleAuthProvider.credential(idToken);

    // Sign-in the user with the credential
    const userCredential = await signInWithCredential(auth, googleCredential);
    const user = userCredential.user;

    // Check if profile exists
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    let userProfile: UserProfile | null = null;
    let isNewUser = false;
    
    if (userDoc.exists()) {
      userProfile = userDoc.data() as UserProfile;
    } else {
      isNewUser = true;
    }

    return { user, userProfile, isNewUser };
  } catch (error) {
    console.error('Error during Google Sign-In:', error);
    throw error;
  }
};

export const setGoogleUserRole = async (user: any, role: Role) => {
  try {
    const userProfile: UserProfile = {
      id: user.uid,
      role,
      email: user.email || '',
      name: user.displayName || 'Google User',
      createdAt: new Date().toISOString(),
    };
    
    if (role === 'Child') {
      userProfile.pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    }
    await setDoc(doc(db, 'users', user.uid), userProfile);
    return userProfile;
  } catch (error) {
    console.error('Error setting Google User role:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore if not logged in via Google
    }
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
};

export const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

export const linkGoogleAccount = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User tidak ditemukan.');

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();

    if (result.type === 'cancelled') {
      const cancelError = new Error('Sign-in cancelled by user');
      (cancelError as any).code = 'SIGN_IN_CANCELLED';
      throw cancelError;
    }

    const idToken = result.data?.idToken;
    if (!idToken) {
      throw new Error('No ID token found');
    }

    const credential = GoogleAuthProvider.credential(idToken);
    await linkWithCredential(user, credential);
    return user;
  } catch (error) {
    console.error('Error linking Google account:', error);
    throw error;
  }
};
