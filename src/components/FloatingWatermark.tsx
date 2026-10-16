import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';

interface FloatingWatermarkProps {
  studentName?: string;
  studentIdOrEmail?: string;
}

export const FloatingWatermark: React.FC<FloatingWatermarkProps> = ({
  studentName = 'Student',
  studentIdOrEmail = '',
}) => {
  const [timestamp, setTimestamp] = useState<string>(new Date().toLocaleTimeString('en-IN'));
  const [containerSize, setContainerSize] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  });
  const [badgeSize, setBadgeSize] = useState({ width: 220, height: 44 });

  const animX = useRef(new Animated.Value(20)).current;
  const animY = useRef(new Animated.Value(50)).current;

  // Update timestamp every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTimestamp(new Date().toLocaleTimeString('en-IN'));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Continuous bouncing animation
  useEffect(() => {
    let isCancelled = false;

    const startXAnimation = () => {
      if (isCancelled) return;
      const maxX = Math.max(10, containerSize.width - badgeSize.width - 20);
      const targetX = Math.random() * maxX;
      const duration = 4000 + Math.random() * 3000;

      Animated.timing(animX, {
        toValue: targetX,
        duration,
        useNativeDriver: true,
      }).start(() => {
        if (!isCancelled) startXAnimation();
      });
    };

    const startYAnimation = () => {
      if (isCancelled) return;
      const maxY = Math.max(30, containerSize.height - badgeSize.height - 80);
      const targetY = 30 + Math.random() * maxY;
      const duration = 5000 + Math.random() * 3000;

      Animated.timing(animY, {
        toValue: targetY,
        duration,
        useNativeDriver: true,
      }).start(() => {
        if (!isCancelled) startYAnimation();
      });
    };

    startXAnimation();
    startYAnimation();

    return () => {
      isCancelled = true;
      animX.stopAnimation();
      animY.stopAnimation();
    };
  }, [animX, animY, containerSize, badgeSize]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setContainerSize({ width, height });
    }
  };

  const onBadgeLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setBadgeSize({ width, height });
    }
  };

  const displayText = `${studentName} | ${studentIdOrEmail} | ${timestamp}`;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onContainerLayout}
    >
      <Animated.View
        style={[
          styles.badge,
          {
            transform: [
              { translateX: animX },
              { translateY: animY },
            ],
          },
        ]}
        onLayout={onBadgeLayout}
      >
        <Text style={styles.text} numberOfLines={2}>
          {displayText}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  text: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
