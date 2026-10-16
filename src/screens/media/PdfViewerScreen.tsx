import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Shield, Lock } from 'lucide-react-native';
import { WebView } from 'react-native-webview';

import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { enableScreenSecurity, disableScreenSecurity } from '../../services/security';
import { FloatingWatermark } from '../../components/FloatingWatermark';

type Props = NativeStackScreenProps<RootStackParamList, 'PdfViewer'>;

export const PdfViewerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { title, fileUrl, description } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Enforce Android FLAG_SECURE on mount
  useEffect(() => {
    enableScreenSecurity('pdf-view');
    return () => {
      disableScreenSecurity('pdf-view');
    };
  }, []);

  // Format secure Google Docs PDF viewer URL
  const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.lockRow}>
            <Lock size={11} color="#16A34A" />
            <Text style={styles.lockText}>Encrypted Student Session</Text>
          </View>
        </View>
        <View style={styles.drmBadge}>
          <Shield size={14} color="#4F46E5" />
        </View>
      </View>

      {/* Main PDF Viewport */}
      <View style={styles.viewerContainer}>
        <WebView
          source={{ uri: viewerUrl }}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
          showsVerticalScrollIndicator={false}
          javaScriptEnabled
          domStorageEnabled
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Decrypting document...</Text>
          </View>
        ) : null}

        {/* Dynamic Bouncing Anti-Piracy Watermark */}
        <FloatingWatermark
          studentName={user?.name || 'Student'}
          studentIdOrEmail={user?.studentId || user?.email || ''}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  lockText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  drmBadge: {
    padding: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
  },
  viewerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  webview: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
});
