import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Shield,
  Gauge,
  Volume2,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { enableScreenSecurity, disableScreenSecurity } from '../../services/security';
import { FloatingWatermark } from '../../components/FloatingWatermark';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoPlayer'>;

const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

function formatSeconds(sec: number): string {
  const totalSeconds = Math.floor(sec || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export const VideoPlayerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { title, videoUrl, description, isLiveRecording } = route.params;
  const { user } = useAuth();

  const [rate, setRate] = useState<number>(1.0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [speedModalVisible, setSpeedModalVisible] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(1);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.playbackRate = 1.0;
    p.play();
  });

  // Track player events
  useEffect(() => {
    const subPlaying = player.addListener('playingChange', (event: { isPlaying: boolean }) => {
      setIsPlaying(event.isPlaying);
    });

    const timer = setInterval(() => {
      try {
        if (player.currentTime != null) {
          setCurrentTime(player.currentTime);
        }
        if (player.duration && player.duration > 0) {
          setDuration(player.duration);
        }
      } catch {
        /* ignore */
      }
    }, 500);

    return () => {
      subPlaying.remove();
      clearInterval(timer);
    };
  }, [player]);

  // Enforce Android FLAG_SECURE on mount
  useEffect(() => {
    enableScreenSecurity('video-view');
    return () => {
      disableScreenSecurity('video-view');
    };
  }, []);

  // Auto-pause when app transitions to background or phone receives a call
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        player.pause();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [player]);

  const progressRatio = duration > 0 ? currentTime / duration : 0;

  const togglePlayPause = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const seekRelative = (seconds: number) => {
    try {
      player.seekBy(seconds);
    } catch {
      player.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const handleSpeedChange = (newRate: number) => {
    setRate(newRate);
    player.playbackRate = newRate;
    setSpeedModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {isLiveRecording ? 'Live Class Recording' : 'Lecture Video'}
          </Text>
        </View>
        <View style={styles.drmBadge}>
          <Shield size={14} color="#818CF8" />
        </View>
      </View>

      {/* Video Viewport Container */}
      <TouchableOpacity
        style={styles.playerContainer}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      >
        <VideoView
          player={player}
          style={styles.videoElement}
          contentFit="contain"
          nativeControls={false}
        />

        {/* Dynamic Bouncing Anti-Piracy Watermark directly over video */}
        <FloatingWatermark
          studentName={user?.name || 'Student'}
          studentIdOrEmail={user?.studentId || user?.email || ''}
        />

        {/* Custom Playback Controls Overlay */}
        {showControls ? (
          <View style={styles.controlsOverlay}>
            <View style={styles.centerControls}>
              <TouchableOpacity
                style={styles.seekBtn}
                onPress={() => seekRelative(-10)}
                activeOpacity={0.7}
              >
                <RotateCcw size={24} color="#FFFFFF" />
                <Text style={styles.seekText}>10s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playPauseBtn}
                onPress={togglePlayPause}
                activeOpacity={0.7}
              >
                {isPlaying ? (
                  <Pause size={32} color="#FFFFFF" />
                ) : (
                  <Play size={32} color="#FFFFFF" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.seekBtn}
                onPress={() => seekRelative(10)}
                activeOpacity={0.7}
              >
                <RotateCw size={24} color="#FFFFFF" />
                <Text style={styles.seekText}>10s</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Progress Bar & Timing */}
            <View style={styles.bottomBar}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
              </View>

              <View style={styles.timeRow}>
                <Text style={styles.timeText}>
                  {formatSeconds(currentTime)} / {formatSeconds(duration)}
                </Text>

                <TouchableOpacity
                  style={styles.speedBtn}
                  onPress={() => setSpeedModalVisible(!speedModalVisible)}
                  activeOpacity={0.7}
                >
                  <Gauge size={14} color="#FFFFFF" />
                  <Text style={styles.speedText}>{rate}x</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* Speed Selector Bar */}
      {speedModalVisible ? (
        <View style={styles.speedModal}>
          <Text style={styles.speedModalTitle}>Playback Speed:</Text>
          <View style={styles.speedGrid}>
            {PLAYBACK_RATES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.speedOption, rate === r && styles.speedOptionSelected]}
                onPress={() => handleSpeedChange(r)}
              >
                <Text
                  style={[
                    styles.speedOptionText,
                    rate === r && styles.speedOptionTextSelected,
                  ]}
                >
                  {r}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {/* Video Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>{title}</Text>
        {description ? (
          <Text style={styles.detailsDesc}>{description}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  drmBadge: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoElement: {
    width: '100%',
    height: '100%',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    padding: 16,
  },
  centerControls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
  },
  seekBtn: {
    alignItems: 'center',
    padding: 8,
  },
  seekText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  bottomBar: {
    gap: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  speedModal: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  speedModalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 10,
  },
  speedGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  speedOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  speedOptionSelected: {
    backgroundColor: '#4F46E5',
  },
  speedOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  speedOptionTextSelected: {
    color: '#FFFFFF',
  },
  detailsContainer: {
    padding: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  detailsDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
});
