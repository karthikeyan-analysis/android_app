import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  LayoutDashboard,
  FolderOpen,
  Award,
  Video,
} from 'lucide-react-native';

import { useAuth } from '../context/AuthContext';
import {
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList,
} from '../types';

// Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { GuestExamJoinScreen } from '../screens/auth/GuestExamJoinScreen';
import { BatchSelectionScreen } from '../screens/batch/BatchSelectionScreen';
import { StudentDashboardScreen } from '../screens/dashboard/StudentDashboardScreen';
import { MediaLibraryScreen } from '../screens/media/MediaLibraryScreen';
import { PdfViewerScreen } from '../screens/media/PdfViewerScreen';
import { VideoPlayerScreen } from '../screens/media/VideoPlayerScreen';
import { TestScheduleScreen } from '../screens/tests/TestScheduleScreen';
import { TakeExamScreen } from '../screens/tests/TakeExamScreen';
import { ExamResultScreen } from '../screens/tests/ExamResultScreen';
import { ResponseSheetScreen } from '../screens/tests/ResponseSheetScreen';
import { LiveClassesScreen } from '../screens/live/LiveClassesScreen';
import { LiveClassRoomScreen } from '../screens/live/LiveClassRoomScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// 1. Unauthenticated Auth Stack
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="GuestExamJoin" component={GuestExamJoinScreen} />
    </AuthStack.Navigator>
  );
};

// 2. Authenticated Student Bottom Tabs
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={StudentDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MediaTab"
        component={MediaLibraryScreen}
        options={{
          tabBarLabel: 'Study Media',
          tabBarIcon: ({ color, size }) => (
            <FolderOpen size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TestsTab"
        component={TestScheduleScreen}
        options={{
          tabBarLabel: 'Tests & CBT',
          tabBarIcon: ({ color, size }) => (
            <Award size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="LiveClassesTab"
        component={LiveClassesScreen}
        options={{
          tabBarLabel: 'Live Classes',
          tabBarIcon: ({ color, size }) => (
            <Video size={size || 22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// 3. Root Navigation Container
export const RootNavigator = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  // Multi-batch check on first launch
  const needsBatchSelection =
    isAuthenticated &&
    !user?.isGuestExamParticipant &&
    user?.batchIds &&
    user.batchIds.length > 1 &&
    !user?.batchId;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : needsBatchSelection ? (
          <RootStack.Screen name="BatchSelection" component={BatchSelectionScreen} />
        ) : (
          <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
        )}

        {/* Fullscreen Modals & Specialized Screens */}
        <RootStack.Screen
          name="PdfViewer"
          component={PdfViewerScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        <RootStack.Screen
          name="VideoPlayer"
          component={VideoPlayerScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        <RootStack.Screen
          name="TakeExam"
          component={TakeExamScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        <RootStack.Screen
          name="ExamResult"
          component={ExamResultScreen}
          options={{ presentation: 'card' }}
        />
        <RootStack.Screen
          name="ResponseSheet"
          component={ResponseSheetScreen}
          options={{ presentation: 'card' }}
        />
        <RootStack.Screen
          name="LiveClassRoom"
          component={LiveClassRoomScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

