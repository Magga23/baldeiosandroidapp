
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface Project {
  id: string;
  external_id?: string;
  address?: string;
  zipcode?: string;
  city?: string;
  plz?: string;
  stadt?: string;
  status: string;
  description?: string;
  progress?: number;
  created_at?: string;
}

type FilterType = 'all' | 'active' | 'completed' | 'on_hold';
type SortType = 'date' | 'status' | 'external_id';

export default function ProjectsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const fetchProjects = async () => {
    console.log('ProjectsScreen: Fetching projects from Supabase');
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('projects')
        .select('id,external_id,address,zipcode,city,plz,stadt,status,description,created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('ProjectsScreen: Error fetching projects', error);
      } else {
        console.log('ProjectsScreen: Projects loaded', data?.length || 0);
        setProjects(data || []);
      }
    } catch (error) {
      console.error('ProjectsScreen: Error fetching projects', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const onRefresh = () => {
    console.log('ProjectsScreen: User pulled to refresh');
    setRefreshing(true);
    fetchProjects();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'in_progress':
      case 'aktiv':
        return themeColors.primary;
      case 'completed':
      case 'abgeschlossen':
        return themeColors.success;
      case 'on_hold':
      case 'pausiert':
        return themeColors.warning;
      default:
        return themeColors.textSecondary;
    }
  };

  const getStatusGradient = (status: string): [string, string] => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'in_progress':
      case 'aktiv':
        return [themeColors.primary, themeColors.primaryDark];
      case 'completed':
      case 'abgeschlossen':
        return [themeColors.success, themeColors.successDark];
      case 'on_hold':
      case 'pausiert':
        return [themeColors.warning, themeColors.warningDark];
      default:
        return [themeColors.textSecondary, themeColors.textSecondary];
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'in_progress':
      case 'aktiv':
        return 'play-circle-filled';
      case 'completed':
      case 'abgeschlossen':
        return 'check-circle';
      case 'on_hold':
      case 'pausiert':
        return 'pause-circle-filled';
      default:
        return 'info';
    }
  };

  const getFullAddress = (project: Project) => {
    const parts = [
      project.address,
      project.zipcode || project.plz,
      project.city || project.stadt,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : 'No address provided';
  };

  const filteredAndSortedProjects = useMemo(() => {
    console.log('ProjectsScreen: Filtering projects with query:', searchQuery, 'filter:', activeFilter, 'sort:', sortBy);
    
    let filtered = [...projects];

    if (activeFilter !== 'all') {
      filtered = filtered.filter(project => {
        const status = project.status?.toLowerCase();
        if (activeFilter === 'active') {
          return status === 'active' || status === 'in_progress' || status === 'aktiv';
        }
        if (activeFilter === 'completed') {
          return status === 'completed' || status === 'abgeschlossen';
        }
        if (activeFilter === 'on_hold') {
          return status === 'on_hold' || status === 'pausiert';
        }
        return true;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => 
        project.external_id?.toLowerCase().includes(query) ||
        project.address?.toLowerCase().includes(query) ||
        project.city?.toLowerCase().includes(query) ||
        project.stadt?.toLowerCase().includes(query) ||
        project.zipcode?.toLowerCase().includes(query) ||
        project.plz?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '');
      }
      if (sortBy === 'external_id') {
        return (a.external_id || '').localeCompare(b.external_id || '');
      }
      return 0;
    });

    console.log('ProjectsScreen: Filtered results:', filtered.length);
    return filtered;
  }, [projects, searchQuery, activeFilter, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: projects.length,
      active: 0,
      completed: 0,
      on_hold: 0,
    };

    projects.forEach(project => {
      const status = project.status?.toLowerCase();
      if (status === 'active' || status === 'in_progress' || status === 'aktiv') {
        counts.active++;
      } else if (status === 'completed' || status === 'abgeschlossen') {
        counts.completed++;
      } else if (status === 'on_hold' || status === 'pausiert') {
        counts.on_hold++;
      }
    });

    return counts;
  }, [projects]);

  const handleFilterChange = (filter: FilterType) => {
    console.log('ProjectsScreen: User changed filter to', filter);
    setActiveFilter(filter);
  };

  const handleSortChange = (sort: SortType) => {
    console.log('ProjectsScreen: User changed sort to', sort);
    setSortBy(sort);
    setShowSortMenu(false);
  };

  const clearSearch = () => {
    console.log('ProjectsScreen: User cleared search');
    setSearchQuery('');
  };

  const handleProjectPress = (projectId: string) => {
    console.log('ProjectsScreen: User tapped project', projectId);
    router.push(`/project/${projectId}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: themeColors.text }]}>Projects</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              {filteredAndSortedProjects.length} of {projects.length} projects
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: themeColors.card }, shadows.small]}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={themeColors.textSecondary}
          />
          <TextInput
            style={[styles.searchInput, { color: themeColors.text }]}
            placeholder="Search by ID, address, or city..."
            placeholderTextColor={themeColors.textSecondary}
            value={searchQuery}
            onChangeText={(text) => {
              console.log('ProjectsScreen: User searching for', text);
              setSearchQuery(text);
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={20}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter and Sort Row */}
        <View style={styles.controlsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterContainer}
            contentContainerStyle={styles.filterContent}
          >
            {[
              { key: 'all' as FilterType, label: 'All', count: statusCounts.all },
              { key: 'active' as FilterType, label: 'Active', count: statusCounts.active },
              { key: 'completed' as FilterType, label: 'Completed', count: statusCounts.completed },
              { key: 'on_hold' as FilterType, label: 'On Hold', count: statusCounts.on_hold },
            ].map((filter, index) => (
              <TouchableOpacity
                key={`filter-${filter.key}-${index}`}
                style={[
                  styles.filterTab,
                  { backgroundColor: themeColors.card },
                  activeFilter === filter.key && { backgroundColor: themeColors.primary },
                  shadows.small,
                ]}
                onPress={() => handleFilterChange(filter.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: themeColors.text },
                    activeFilter === filter.key && { color: '#FFFFFF' },
                  ]}
                >
                  {filter.label}
                </Text>
                <View
                  style={[
                    styles.badge,
                    activeFilter === filter.key
                      ? { backgroundColor: 'rgba(255, 255, 255, 0.3)' }
                      : { backgroundColor: themeColors.primary + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      activeFilter === filter.key
                        ? { color: '#FFFFFF' }
                        : { color: themeColors.primary },
                    ]}
                  >
                    {filter.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: themeColors.card }, shadows.small]}
            onPress={() => {
              console.log('ProjectsScreen: User toggled sort menu');
              setShowSortMenu(!showSortMenu);
            }}
          >
            <IconSymbol
              ios_icon_name="arrow.up.arrow.down"
              android_material_icon_name="sort"
              size={20}
              color={themeColors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Sort Menu */}
        {showSortMenu && (
          <View style={[styles.sortMenu, { backgroundColor: themeColors.card }, shadows.medium]}>
            {[
              { key: 'date' as SortType, label: 'Date Created', icon: 'calendar-today' },
              { key: 'status' as SortType, label: 'Status', icon: 'info' },
              { key: 'external_id' as SortType, label: 'External ID', icon: 'tag' },
            ].map((sort, index) => (
              <TouchableOpacity
                key={`sort-${sort.key}-${index}`}
                style={[
                  styles.sortOption,
                  sortBy === sort.key && { backgroundColor: themeColors.primary + '20' },
                ]}
                onPress={() => handleSortChange(sort.key)}
              >
                <IconSymbol
                  ios_icon_name={sort.icon}
                  android_material_icon_name={sort.icon}
                  size={20}
                  color={sortBy === sort.key ? themeColors.primary : themeColors.text}
                />
                <Text
                  style={[
                    styles.sortOptionText,
                    { color: sortBy === sort.key ? themeColors.primary : themeColors.text },
                  ]}
                >
                  {sort.label}
                </Text>
                {sortBy === sort.key && (
                  <IconSymbol
                    ios_icon_name="checkmark"
                    android_material_icon_name="check"
                    size={20}
                    color={themeColors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Projects List */}
        {loading && projects.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading projects...</Text>
          </View>
        ) : filteredAndSortedProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="folder"
              android_material_icon_name="folder"
              size={64}
              color={themeColors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: themeColors.text }]}>
              {searchQuery || activeFilter !== 'all' ? 'No matching projects' : 'No projects yet'}
            </Text>
            <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
              {searchQuery || activeFilter !== 'all'
                ? 'Try adjusting your filters or search'
                : 'Projects will appear here once created'}
            </Text>
          </View>
        ) : (
          <View style={styles.projectsList}>
            {filteredAndSortedProjects.map((project, index) => (
              <Animated.View key={`project-${project.id}-${index}`} entering={FadeInDown.delay(index * 50).duration(400)}>
                <TouchableOpacity
                  style={[styles.projectCard, { backgroundColor: themeColors.card }, shadows.medium]}
                  onPress={() => handleProjectPress(project.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.projectCardHeader}>
                    {/* Project Icon with Gradient */}
                    <LinearGradient
                      colors={getStatusGradient(project.status)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.projectIcon}
                    >
                      <IconSymbol
                        ios_icon_name="folder.fill"
                        android_material_icon_name={getStatusIcon(project.status)}
                        size={24}
                        color="#FFFFFF"
                      />
                    </LinearGradient>

                    <View style={styles.projectHeaderContent}>
                      {/* External ID */}
                      {project.external_id && (
                        <Text style={[styles.externalId, { color: themeColors.text }]}>
                          {project.external_id}
                        </Text>
                      )}

                      {/* Status Badge */}
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(project.status) + '20' },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: getStatusColor(project.status) },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            { color: getStatusColor(project.status) },
                          ]}
                        >
                          {project.status || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Project Address */}
                  <View style={styles.addressContainer}>
                    <IconSymbol
                      ios_icon_name="location.fill"
                      android_material_icon_name="location-on"
                      size={18}
                      color={themeColors.textSecondary}
                    />
                    <Text style={[styles.address, { color: themeColors.text }]} numberOfLines={2}>
                      {getFullAddress(project)}
                    </Text>
                  </View>

                  {/* Progress Bar (if available) */}
                  {project.progress !== undefined && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressHeader}>
                        <Text style={[styles.progressLabel, { color: themeColors.textSecondary }]}>Progress</Text>
                        <Text style={[styles.progressValue, { color: themeColors.text }]}>
                          {project.progress}%
                        </Text>
                      </View>
                      <View style={[styles.progressBar, { backgroundColor: themeColors.background }]}>
                        <LinearGradient
                          colors={getStatusGradient(project.status)}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[
                            styles.progressFill,
                            { width: `${project.progress}%` },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Chevron */}
                  <View style={styles.chevronContainer}>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="chevron-right"
                      size={20}
                      color={themeColors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingHorizontal: spacing.md,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodySmall,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.xs,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  filterContainer: {
    flex: 1,
  },
  filterContent: {
    gap: spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  filterText: {
    ...typography.body,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typography.bodySmall,
    fontWeight: '700',
    fontSize: 12,
  },
  sortButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortMenu: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  sortOptionText: {
    ...typography.body,
    flex: 1,
    fontWeight: '500',
  },
  projectsList: {
    gap: spacing.md,
  },
  projectCard: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
  },
  projectCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  projectIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectHeaderContent: {
    flex: 1,
    gap: spacing.xs,
  },
  externalId: {
    ...typography.h3,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.bodySmall,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  address: {
    ...typography.body,
    flex: 1,
    lineHeight: 22,
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    ...typography.bodySmall,
  },
  progressValue: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  chevronContainer: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    marginTop: -10,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyText: {
    ...typography.h3,
    marginTop: spacing.md,
    fontWeight: '700',
  },
  emptySubtext: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
