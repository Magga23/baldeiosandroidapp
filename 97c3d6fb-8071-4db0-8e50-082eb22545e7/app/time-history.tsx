
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import TimeEntryDetailModal from '@/components/TimeEntryDetailModal';

interface TimeEntry {
  id: string;
  project_id?: string;
  employee: string;
  employee_name?: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  task: string;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  end_location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  project_external_id?: string;
  project_address?: string;
  created_at?: string;
}

export default function TimeHistoryScreen() {
  console.log('TimeHistoryScreen: Rendering time history screen');
  const theme = useTheme();
  const { user } = useAuth();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [isContractorOrSubcontractor, setIsContractorOrSubcontractor] = useState(false);
  
  // Modal state
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchTimeEntries = useCallback(async () => {
    console.log('TimeHistoryScreen: Fetching time entries with filter:', filter, 'for user:', user?.id);
    
    if (!user?.id) {
      console.log('TimeHistoryScreen: No user ID available, cannot fetch entries');
      return;
    }

    try {
      setLoading(true);
      
      // ALWAYS check if this user has employees (regardless of user_role field)
      console.log('TimeHistoryScreen: Checking if user has any employees');
      const { data: employees, error: employeesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, username')
        .eq('created_by', user.id);

      if (employeesError) {
        console.error('TimeHistoryScreen: Error fetching employees:', employeesError);
      }

      const hasEmployees = employees && employees.length > 0;
      console.log('TimeHistoryScreen: User has', employees?.length || 0, 'employees');

      let employeeIds: string[] = [];

      if (hasEmployees) {
        // This user is a contractor/subcontractor - show their employees' entries + their own
        employeeIds = employees.map(emp => emp.id);
        employeeIds.push(user.id); // Include contractor's own entries
        console.log('TimeHistoryScreen: User is contractor/subcontractor (has employees), showing team entries');
        setIsContractorOrSubcontractor(true);
      } else {
        // Regular employee - only show their own entries
        employeeIds = [user.id];
        console.log('TimeHistoryScreen: User is regular employee (no employees), showing only their entries');
        setIsContractorOrSubcontractor(false);
      }

      // Build query - FILTER BY EMPLOYEE IDS
      let query = supabase
        .from('time_entries')
        .select('*')
        .in('employee', employeeIds)
        .order('start_time', { ascending: false });
      
      if (filter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('start_time', today.toISOString());
      } else if (filter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('start_time', weekAgo.toISOString());
      }

      console.log('TimeHistoryScreen: Fetching entries for employee IDs:', employeeIds);

      const { data: entries, error } = await query;

      if (error) {
        console.error('TimeHistoryScreen: Error fetching entries:', error);
        console.error('TimeHistoryScreen: Error details:', JSON.stringify(error, null, 2));
      } else {
        console.log('TimeHistoryScreen: Fetched', entries?.length || 0, 'entries for user');
        
        // Fetch employee names for all entries
        if (entries && entries.length > 0) {
          const uniqueEmployeeIds = [...new Set(entries.map(e => e.employee))];
          console.log('TimeHistoryScreen: Fetching profiles for employee IDs:', uniqueEmployeeIds);
          
          const { data: employeeProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email, username')
            .in('id', uniqueEmployeeIds);

          if (profilesError) {
            console.error('TimeHistoryScreen: Error fetching employee profiles:', profilesError);
          } else {
            console.log('TimeHistoryScreen: Fetched', employeeProfiles?.length || 0, 'employee profiles');
            
            // Map employee names to entries
            const profileMap = new Map(
              employeeProfiles?.map(p => [
                p.id,
                p.full_name || p.username || p.email || p.id
              ]) || []
            );

            const entriesWithNames = entries.map(entry => ({
              ...entry,
              employee_name: profileMap.get(entry.employee) || entry.employee
            }));

            console.log('TimeHistoryScreen: Added employee names to entries');
            setTimeEntries(entriesWithNames);
          }
        } else {
          console.log('TimeHistoryScreen: No entries found for this user');
          setTimeEntries([]);
        }
      }
    } catch (error) {
      console.error('TimeHistoryScreen: Error fetching time entries:', error);
      console.error('TimeHistoryScreen: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, user]);

  useEffect(() => {
    console.log('TimeHistoryScreen: Component mounted, fetching time entries');
    if (user?.id) {
      fetchTimeEntries();
    }
  }, [user, fetchTimeEntries]);

  const onRefresh = () => {
    console.log('TimeHistoryScreen: User pulled to refresh');
    setRefreshing(true);
    fetchTimeEntries();
  };

  const handleEntryPress = (entry: TimeEntry) => {
    console.log('TimeHistoryScreen: User tapped time entry card:', entry.id);
    setSelectedEntry(entry);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    console.log('TimeHistoryScreen: Closing detail modal');
    setModalVisible(false);
    setSelectedEntry(null);
  };

  const formatDuration = (hours?: number, startTime?: string) => {
    // If no duration and no end_time, calculate ongoing duration
    if (!hours && startTime) {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsedHours = (now - start) / (1000 * 60 * 60);
      const h = Math.floor(elapsedHours);
      const m = Math.round((elapsedHours - h) * 60);
      if (h > 0) {
        return `${h}h ${m}m (Ongoing)`;
      }
      return `${m}m (Ongoing)`;
    }
    
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTotalHours = () => {
    // Only count completed entries for total hours
    const completedEntries = timeEntries.filter(entry => entry.duration);
    const total = completedEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    return total.toFixed(1);
  };

  const getCompletedEntriesCount = () => {
    return timeEntries.filter(entry => entry.end_time).length;
  };

  const getOngoingEntriesCount = () => {
    return timeEntries.filter(entry => !entry.end_time).length;
  };

  const getScreenTitle = () => {
    if (isContractorOrSubcontractor) {
      return 'Team Time History';
    }
    return 'Time History';
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: getScreenTitle(),
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: themeColors.card,
          },
          headerTintColor: themeColors.text,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Role Badge */}
        {isContractorOrSubcontractor && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={[styles.roleBadge, { backgroundColor: themeColors.primary + '20' }]}>
              <IconSymbol
                ios_icon_name="person.3.fill"
                android_material_icon_name="group"
                size={20}
                color={themeColors.primary}
              />
              <Text style={[styles.roleBadgeText, { color: themeColors.primary }]}>
                Viewing your team&apos;s time entries
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Stats Card */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <LinearGradient
            colors={[themeColors.primary, themeColors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.statsCard, shadows.large]}
          >
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{getCompletedEntriesCount()}</Text>
                <Text style={styles.statLabel}>Total Entries</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{getTotalHours()}h</Text>
                <Text style={styles.statLabel}>Total Hours</Text>
              </View>
            </View>
            {getOngoingEntriesCount() > 0 && (
              <View style={styles.ongoingBadge}>
                <IconSymbol
                  ios_icon_name="clock.fill"
                  android_material_icon_name="schedule"
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.ongoingBadgeText}>
                  {getOngoingEntriesCount()} ongoing {getOngoingEntriesCount() === 1 ? 'entry' : 'entries'}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Filter Buttons */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: filter === 'all' ? themeColors.primary : themeColors.card },
            ]}
            onPress={() => {
              console.log('TimeHistoryScreen: User selected All filter');
              setFilter('all');
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: filter === 'all' ? '#FFFFFF' : themeColors.text },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: filter === 'today' ? themeColors.primary : themeColors.card },
            ]}
            onPress={() => {
              console.log('TimeHistoryScreen: User selected Today filter');
              setFilter('today');
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: filter === 'today' ? '#FFFFFF' : themeColors.text },
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: filter === 'week' ? themeColors.primary : themeColors.card },
            ]}
            onPress={() => {
              console.log('TimeHistoryScreen: User selected Week filter');
              setFilter('week');
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: filter === 'week' ? '#FFFFFF' : themeColors.text },
              ]}
            >
              This Week
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Time Entries List */}
        {loading && timeEntries.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        ) : timeEntries.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, { backgroundColor: themeColors.card }]}>
              <IconSymbol
                ios_icon_name="clock"
                android_material_icon_name="schedule"
                size={64}
                color={themeColors.textSecondary}
              />
            </View>
            <Text style={[styles.emptyText, { color: themeColors.text }]}>
              No time entries found
            </Text>
            <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
              {isContractorOrSubcontractor 
                ? 'Your team members haven\'t tracked any time yet'
                : 'Start tracking your time to see entries here'}
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.entriesList}>
            {timeEntries.map((entry, index) => {
              const isOngoing = !entry.end_time;
              return (
                <Animated.View 
                  key={entry.id} 
                  entering={FadeInDown.delay(300 + index * 50).duration(400)}
                >
                  <TouchableOpacity
                    onPress={() => handleEntryPress(entry)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={isOngoing 
                        ? [themeColors.warning + '20', themeColors.warning + '10']
                        : [themeColors.card, themeColors.card]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.entryCard, 
                        shadows.small,
                        isOngoing && { borderWidth: 2, borderColor: themeColors.warning }
                      ]}
                    >
                      {/* Ongoing Badge */}
                      {isOngoing && (
                        <View style={[styles.ongoingEntryBadge, { backgroundColor: themeColors.warning }]}>
                          <IconSymbol
                            ios_icon_name="clock.fill"
                            android_material_icon_name="schedule"
                            size={14}
                            color="#FFFFFF"
                          />
                          <Text style={styles.ongoingEntryBadgeText}>ONGOING</Text>
                        </View>
                      )}

                      {/* Header */}
                      <View style={styles.entryHeader}>
                        <View style={styles.entryHeaderLeft}>
                          <LinearGradient
                            colors={[themeColors.primary + '40', themeColors.primary + '20']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.entryIcon}
                          >
                            <IconSymbol
                              ios_icon_name="person.fill"
                              android_material_icon_name="person"
                              size={24}
                              color={themeColors.primary}
                            />
                          </LinearGradient>
                          <View style={styles.entryHeaderInfo}>
                            <Text style={[styles.entryEmployee, { color: themeColors.text }]}>
                              {entry.employee_name || 'Loading...'}
                            </Text>
                            <Text style={[styles.entryDate, { color: themeColors.textSecondary }]}>
                              {formatDate(entry.start_time)}
                            </Text>
                          </View>
                        </View>
                        <View style={[
                          styles.durationBadge, 
                          { backgroundColor: isOngoing ? themeColors.warning + '20' : themeColors.success + '20' }
                        ]}>
                          <Text style={[
                            styles.durationText, 
                            { color: isOngoing ? themeColors.warning : themeColors.success }
                          ]}>
                            {formatDuration(entry.duration, entry.start_time)}
                          </Text>
                        </View>
                      </View>

                      {/* Task */}
                      <View style={styles.entrySection}>
                        <View style={styles.entryRow}>
                          <IconSymbol
                            ios_icon_name="doc.text"
                            android_material_icon_name="description"
                            size={16}
                            color={themeColors.textSecondary}
                          />
                          <Text style={[styles.entryTask, { color: themeColors.text }]}>
                            {entry.task}
                          </Text>
                        </View>
                      </View>

                      {/* Project Info */}
                      {(entry.project_external_id || entry.project_address) && (
                        <View style={styles.entrySection}>
                          {entry.project_external_id && (
                            <View style={styles.entryRow}>
                              <IconSymbol
                                ios_icon_name="folder"
                                android_material_icon_name="folder"
                                size={16}
                                color={themeColors.textSecondary}
                              />
                              <Text style={[styles.entryDetail, { color: themeColors.textSecondary }]}>
                                {entry.project_external_id}
                              </Text>
                            </View>
                          )}
                          {entry.project_address && (
                            <View style={styles.entryRow}>
                              <IconSymbol
                                ios_icon_name="location"
                                android_material_icon_name="location-on"
                                size={16}
                                color={themeColors.textSecondary}
                              />
                              <Text style={[styles.entryDetail, { color: themeColors.textSecondary }]}>
                                {entry.project_address}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Time Range */}
                      <View style={[styles.timeRange, { backgroundColor: themeColors.background }]}>
                        <View style={styles.timeItem}>
                          <Text style={[styles.timeLabel, { color: themeColors.textSecondary }]}>
                            Start
                          </Text>
                          <Text style={[styles.timeValue, { color: themeColors.text }]}>
                            {formatTime(entry.start_time)}
                          </Text>
                        </View>
                        <IconSymbol
                          ios_icon_name="arrow.right"
                          android_material_icon_name="arrow-forward"
                          size={16}
                          color={themeColors.textSecondary}
                        />
                        <View style={styles.timeItem}>
                          <Text style={[styles.timeLabel, { color: themeColors.textSecondary }]}>
                            End
                          </Text>
                          <Text style={[styles.timeValue, { color: themeColors.text }]}>
                            {entry.end_time ? formatTime(entry.end_time) : '--:--'}
                          </Text>
                        </View>
                      </View>

                      {/* Tap to view details indicator */}
                      <View style={styles.tapIndicator}>
                        <IconSymbol
                          ios_icon_name="chevron.right"
                          android_material_icon_name="chevron-right"
                          size={16}
                          color={themeColors.textSecondary}
                        />
                        <Text style={[styles.tapIndicatorText, { color: themeColors.textSecondary }]}>
                          Tap to view details
                        </Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <TimeEntryDetailModal
        visible={modalVisible}
        onClose={handleCloseModal}
        entry={selectedEntry}
        employeeName={selectedEntry?.employee_name || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 120,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  roleBadgeText: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  statsCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h1,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  ongoingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  ongoingBadgeText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  filterButtonText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
  entriesList: {
    gap: spacing.md,
  },
  entryCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    position: 'relative',
  },
  ongoingEntryBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    zIndex: 10,
  },
  ongoingEntryBadgeText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  entryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  entryIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  entryHeaderInfo: {
    flex: 1,
  },
  entryEmployee: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  entryDate: {
    ...typography.bodySmall,
    fontSize: 13,
  },
  durationBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  durationText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
  entrySection: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  entryTask: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  entryDetail: {
    ...typography.bodySmall,
    flex: 1,
  },
  timeRange: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  timeItem: {
    alignItems: 'center',
  },
  timeLabel: {
    ...typography.bodySmall,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  timeValue: {
    ...typography.body,
    fontWeight: '700',
  },
  tapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  tapIndicatorText: {
    ...typography.bodySmall,
    fontSize: 12,
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.h3,
    marginTop: spacing.md,
    fontWeight: '700',
  },
  emptySubtext: {
    ...typography.body,
    marginTop: spacing.sm,
    textAlign: 'center',
    maxWidth: 280,
  },
});
