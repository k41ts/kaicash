import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ParentDashboardScreen from '../screens/parent/ParentDashboardScreen';
import ParentHistoryScreen from '../screens/parent/ParentHistoryScreen';
import ParentAnalyticsScreen from '../screens/parent/ParentAnalyticsScreen';
import ParentBudgetScreen from '../screens/parent/ParentBudgetScreen';
import ParentSettingsScreen from '../screens/parent/ParentSettingsScreen';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

const Tab = createBottomTabNavigator();

export default function ParentNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        safeAreaInsets: { bottom: 0 },
        tabBarStyle: {
          position: 'absolute',
          bottom: insets.bottom + 12,
          left: 16,
          right: 16,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          height: 72,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <BlurView tint="dark" intensity={80} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,20,0.45)' }]} />
        ),
        tabBarActiveTintColor: '#A28BFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.45)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 6,
        },
        tabBarIconStyle: {
          marginTop: 6,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: any = 'home';
          if (route.name === 'Dashboard') iconName = 'home';
          else if (route.name === 'History') iconName = 'list';
          else if (route.name === 'Budget') iconName = 'dollar-sign';
          else if (route.name === 'Analytics') iconName = 'pie-chart';
          else if (route.name === 'Settings') iconName = 'settings';
          return <Feather name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={ParentDashboardScreen} />
      <Tab.Screen name="Budget" component={ParentBudgetScreen} />
      <Tab.Screen name="Analytics" component={ParentAnalyticsScreen} />
      <Tab.Screen name="History" component={ParentHistoryScreen} />
      <Tab.Screen name="Settings" component={ParentSettingsScreen} />
    </Tab.Navigator>
  );
}
