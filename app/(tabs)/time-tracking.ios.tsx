
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function TimeTrackingScreen() {
  console.log('TimeTrackingScreen (iOS): Rendering time tracking menu');
  const theme = useTheme();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const handleClockIn = () => {
    console.log('TimeTrackingScreen (iOS): User tapped Clock In button, navigating to time-entry');
    router.push('/time-entry');
  };

  const handleTimeHistory = () => {
    console.log('TimeTrackingScreen (iOS): User tapped Time History button, navigating to time-history');
    router.push('/time-history');
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          Time Tracking
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Manage your work hours
        </Text>
      </Animated.View>

      {/* Menu Buttons */}
      <View style={styles.menuContainer}>
        {/* Clock In Button */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.buttonWrapper}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleClockIn}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[themeColors.primary, themeColors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.menuButtonGradient, shadows.large]}
            >
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <IconSymbol
                  ios_icon_name="clock.fill"
                  android_material_icon_name="schedule"
                  size={48}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.menuButtonTitle}>Clock In/Out</Text>
              <Text style={styles.menuButtonSubtitle}>
                Start or stop tracking your time
              </Text>
              <View style={styles.arrowContainer}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={24}
                  color="rgba(255,255,255,0.8)"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Time History Button */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.buttonWrapper}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleTimeHistory}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[themeColors.secondary, themeColors.secondaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.menuButtonGradient, shadows.large]}
            >
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <IconSymbol
                  ios_icon_name="list.bullet"
                  android_material_icon_name="history"
                  size={48}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.menuButtonTitle}>Time History</Text>
              <Text style={styles.menuButtonSubtitle}>
                View your time tracking records
              </Text>
              <View style={styles.arrowContainer}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={24}
                  color="rgba(255,255,255,0.8)"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: spacing.md,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
  },
  menuContainer: {
    gap: spacing.lg,
  },
  buttonWrapper: {
    width: '100%',
  },
  menuButton: {
    width: '100%',
  },
  menuButtonGradient: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  menuButtonTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  menuButtonSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    maxWidth: 280,
  },
  arrowContainer: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  },
});
