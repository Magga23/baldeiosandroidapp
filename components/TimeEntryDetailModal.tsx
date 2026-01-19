
import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';

interface TimeEntryLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface TimeEntry {
  id: string;
  project_id?: string;
  employee: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  task: string;
  location?: TimeEntryLocation;
  end_location?: TimeEntryLocation;
  project_external_id?: string;
  project_address?: string;
  created_at?: string;
}

interface TimeEntryDetailModalProps {
  visible: boolean;
  onClose: () => void;
  entry: TimeEntry | null;
  employeeName: string;
}

export default function TimeEntryDetailModal({
  visible,
  onClose,
  entry,
  employeeName,
}: TimeEntryDetailModalProps) {
  console.log('TimeEntryDetailModal: Rendering modal with entry:', entry?.id);
  const theme = useTheme();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  if (!entry) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (hours?: number) => {
    if (!hours) {
      return 'In Progress';
    }
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${m}m`;
  };

  const hasClockInLocation = entry.location?.latitude && entry.location?.longitude;
  const hasClockOutLocation = entry.end_location?.latitude && entry.end_location?.longitude;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <LinearGradient
                colors={[themeColors.primary + '40', themeColors.primary + '20']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalHeaderIcon}
              >
                <IconSymbol
                  ios_icon_name="clock.fill"
                  android_material_icon_name="schedule"
                  size={24}
                  color={themeColors.primary}
                />
              </LinearGradient>
              <View>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                  Time Entry Details
                </Text>
                <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
                  {formatDate(entry.start_time)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                console.log('TimeEntryDetailModal: User closed modal');
                onClose();
              }}
              style={styles.closeButton}
            >
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={28}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Employee Info */}
            <View style={[styles.section, { backgroundColor: themeColors.card }]}>
              <View style={styles.sectionHeader}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={20}
                  color={themeColors.primary}
                />
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Employee
                </Text>
              </View>
              <Text style={[styles.sectionValue, { color: themeColors.text }]}>
                {employeeName}
              </Text>
            </View>

            {/* Task Info */}
            <View style={[styles.section, { backgroundColor: themeColors.card }]}>
              <View style={styles.sectionHeader}>
                <IconSymbol
                  ios_icon_name="doc.text.fill"
                  android_material_icon_name="description"
                  size={20}
                  color={themeColors.primary}
                />
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Task
                </Text>
              </View>
              <Text style={[styles.sectionValue, { color: themeColors.text }]}>
                {entry.task}
              </Text>
            </View>

            {/* Project Info */}
            {(entry.project_external_id || entry.project_address) && (
              <View style={[styles.section, { backgroundColor: themeColors.card }]}>
                <View style={styles.sectionHeader}>
                  <IconSymbol
                    ios_icon_name="building.2.fill"
                    android_material_icon_name="business"
                    size={20}
                    color={themeColors.primary}
                  />
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    Project
                  </Text>
                </View>
                {entry.project_external_id && (
                  <Text style={[styles.sectionValue, { color: themeColors.text }]}>
                    {entry.project_external_id}
                  </Text>
                )}
                {entry.project_address && (
                  <Text style={[styles.sectionSubvalue, { color: themeColors.textSecondary }]}>
                    {entry.project_address}
                  </Text>
                )}
              </View>
            )}

            {/* Time Range */}
            <View style={[styles.section, { backgroundColor: themeColors.card }]}>
              <View style={styles.sectionHeader}>
                <IconSymbol
                  ios_icon_name="clock.fill"
                  android_material_icon_name="schedule"
                  size={20}
                  color={themeColors.primary}
                />
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Time Range
                </Text>
              </View>
              <View style={styles.timeRangeContainer}>
                <View style={styles.timeRangeItem}>
                  <Text style={[styles.timeRangeLabel, { color: themeColors.textSecondary }]}>
                    Clock In
                  </Text>
                  <Text style={[styles.timeRangeValue, { color: themeColors.text }]}>
                    {formatTime(entry.start_time)}
                  </Text>
                </View>
                <IconSymbol
                  ios_icon_name="arrow.right"
                  android_material_icon_name="arrow-forward"
                  size={20}
                  color={themeColors.textSecondary}
                />
                <View style={styles.timeRangeItem}>
                  <Text style={[styles.timeRangeLabel, { color: themeColors.textSecondary }]}>
                    Clock Out
                  </Text>
                  <Text style={[styles.timeRangeValue, { color: themeColors.text }]}>
                    {entry.end_time ? formatTime(entry.end_time) : 'Ongoing'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Duration */}
            <View style={[styles.section, { backgroundColor: themeColors.card }]}>
              <View style={styles.sectionHeader}>
                <IconSymbol
                  ios_icon_name="timer"
                  android_material_icon_name="timer"
                  size={20}
                  color={themeColors.primary}
                />
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Duration
                </Text>
              </View>
              <Text style={[styles.durationValue, { color: themeColors.primary }]}>
                {formatDuration(entry.duration)}
              </Text>
            </View>

            {/* Clock In Location */}
            {hasClockInLocation && (
              <View style={[styles.section, { backgroundColor: themeColors.card }]}>
                <View style={styles.sectionHeader}>
                  <IconSymbol
                    ios_icon_name="location.fill"
                    android_material_icon_name="location-on"
                    size={20}
                    color={themeColors.success}
                  />
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    Clock In Location
                  </Text>
                </View>
                <View style={styles.locationInfo}>
                  {entry.location?.address && (
                    <Text style={[styles.locationAddress, { color: themeColors.text }]}>
                      {entry.location.address}
                    </Text>
                  )}
                  <Text style={[styles.locationCoords, { color: themeColors.textSecondary }]}>
                    Coordinates: {entry.location?.latitude.toFixed(6)}, {entry.location?.longitude.toFixed(6)}
                  </Text>
                </View>
                
                {/* Map Placeholder - react-native-maps not supported */}
                <View style={[styles.mapPlaceholder, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                  <IconSymbol
                    ios_icon_name="map.fill"
                    android_material_icon_name="map"
                    size={48}
                    color={themeColors.textSecondary}
                  />
                  <Text style={[styles.mapPlaceholderText, { color: themeColors.textSecondary }]}>
                    Maps are not supported on web in Natively
                  </Text>
                  <Text style={[styles.mapPlaceholderSubtext, { color: themeColors.textSecondary }]}>
                    Location data is saved and can be viewed on native apps
                  </Text>
                </View>
              </View>
            )}

            {/* Clock Out Location */}
            {hasClockOutLocation && (
              <View style={[styles.section, { backgroundColor: themeColors.card }]}>
                <View style={styles.sectionHeader}>
                  <IconSymbol
                    ios_icon_name="location.fill"
                    android_material_icon_name="location-on"
                    size={20}
                    color={themeColors.error}
                  />
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    Clock Out Location
                  </Text>
                </View>
                <View style={styles.locationInfo}>
                  {entry.end_location?.address && (
                    <Text style={[styles.locationAddress, { color: themeColors.text }]}>
                      {entry.end_location.address}
                    </Text>
                  )}
                  <Text style={[styles.locationCoords, { color: themeColors.textSecondary }]}>
                    Coordinates: {entry.end_location?.latitude.toFixed(6)}, {entry.end_location?.longitude.toFixed(6)}
                  </Text>
                </View>
                
                {/* Map Placeholder - react-native-maps not supported */}
                <View style={[styles.mapPlaceholder, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                  <IconSymbol
                    ios_icon_name="map.fill"
                    android_material_icon_name="map"
                    size={48}
                    color={themeColors.textSecondary}
                  />
                  <Text style={[styles.mapPlaceholderText, { color: themeColors.textSecondary }]}>
                    Maps are not supported on web in Natively
                  </Text>
                  <Text style={[styles.mapPlaceholderSubtext, { color: themeColors.textSecondary }]}>
                    Location data is saved and can be viewed on native apps
                  </Text>
                </View>
              </View>
            )}

            {/* No Location Info */}
            {!hasClockInLocation && !hasClockOutLocation && (
              <View style={[styles.section, { backgroundColor: themeColors.card }]}>
                <View style={styles.sectionHeader}>
                  <IconSymbol
                    ios_icon_name="location.slash"
                    android_material_icon_name="location-off"
                    size={20}
                    color={themeColors.textSecondary}
                  />
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    Location
                  </Text>
                </View>
                <Text style={[styles.noLocationText, { color: themeColors.textSecondary }]}>
                  No location data available for this entry
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  modalSubtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  section: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  sectionValue: {
    ...typography.body,
    fontSize: 15,
  },
  sectionSubvalue: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  timeRangeItem: {
    alignItems: 'center',
  },
  timeRangeLabel: {
    ...typography.bodySmall,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  timeRangeValue: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  durationValue: {
    ...typography.h2,
    fontWeight: '700',
  },
  locationInfo: {
    marginBottom: spacing.md,
  },
  locationAddress: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
  },
  locationCoords: {
    ...typography.bodySmall,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  mapPlaceholder: {
    height: 200,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: spacing.lg,
  },
  mapPlaceholderText: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  mapPlaceholderSubtext: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  noLocationText: {
    ...typography.body,
    fontStyle: 'italic',
  },
});
