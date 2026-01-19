
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  useColorScheme,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;
  const colorScheme = useColorScheme();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(colorScheme === 'dark');
  const [stats, setStats] = useState({
    activeProjects: 0,
    completedProjects: 0,
    hoursTracked: 0,
    shopItems: 0,
  });

  const fetchDashboardData = async () => {
    console.log('HomeScreen: Fetching dashboard data');
    try {
      setLoading(true);
      
      // Fetch real project counts
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('status');

      if (!projectsError && projects) {
        const activeCount = projects.filter(p => 
          ['active', 'in_progress', 'aktiv'].includes(p.status?.toLowerCase())
        ).length;
        const completedCount = projects.filter(p => 
          ['completed', 'abgeschlossen'].includes(p.status?.toLowerCase())
        ).length;

        setStats(prev => ({
          ...prev,
          activeProjects: activeCount,
          completedProjects: completedCount,
        }));
      }

      // Fetch time entries
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select('duration');

      if (!timeError && timeEntries) {
        const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
        const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
        setStats(prev => ({ ...prev, hoursTracked: totalHours }));
      }

      // Fetch shop items
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('is_active', true);

      if (!productsError && products) {
        setStats(prev => ({ ...prev, shopItems: products.length }));
      }
      
      console.log('HomeScreen: Dashboard data loaded');
    } catch (error) {
      console.error('HomeScreen: Error fetching dashboard data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const onRefresh = () => {
    console.log('HomeScreen: User pulled to refresh');
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleLogout = async () => {
    console.log('HomeScreen: User tapped Logout');
    setShowAvatarMenu(false);
    await signOut();
    router.replace('/auth');
  };

  const handleProfile = () => {
    console.log('HomeScreen: User tapped Profile');
    setShowAvatarMenu(false);
    router.push('/(tabs)/profile');
  };

  const toggleDarkMode = () => {
    console.log('HomeScreen: User toggled dark mode');
    setDarkModeEnabled(!darkModeEnabled);
    // Note: In a real app, you would persist this preference and apply it globally
    // For now, this is just a visual toggle
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
        {/* Header with Gradient */}
        <Animated.View entering={FadeInUp.duration(600)}>
          <LinearGradient
            colors={[themeColors.gradientStart, themeColors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.greeting}>
                  Welcome back,
                </Text>
                <Text style={styles.title}>
                  BALDE Dashboard
                </Text>
              </View>
              <View style={styles.headerIcons}>
                {/* Dark Mode Toggle */}
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={toggleDarkMode}
                >
                  <IconSymbol
                    ios_icon_name={darkModeEnabled ? "sun.max.fill" : "moon.fill"}
                    android_material_icon_name={darkModeEnabled ? "wb-sunny" : "nightlight-round"}
                    size={24}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Notification Icon */}
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => {
                    console.log('HomeScreen: User tapped Notifications');
                    // TODO: Navigate to notifications screen
                  }}
                >
                  <IconSymbol
                    ios_icon_name="bell.fill"
                    android_material_icon_name="notifications"
                    size={24}
                    color="#FFFFFF"
                  />
                  {/* Notification Badge */}
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>3</Text>
                  </View>
                </TouchableOpacity>

                {/* Avatar with Dropdown */}
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => {
                    console.log('HomeScreen: User tapped Avatar');
                    setShowAvatarMenu(!showAvatarMenu);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={28}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Stats Cards with Gradients */}
        <View style={styles.statsGrid}>
          <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.statCardWrapper}>
            <TouchableOpacity
              style={styles.statCardTouchable}
              onPress={() => {
                console.log('HomeScreen: User tapped Active Projects card');
                router.push('/(tabs)/projects');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[themeColors.primary, themeColors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, shadows.medium]}
              >
                <View style={styles.statIconContainer}>
                  <IconSymbol
                    ios_icon_name="folder.fill"
                    android_material_icon_name="folder"
                    size={28}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.statValue}>
                  {stats.activeProjects}
                </Text>
                <Text style={styles.statLabel}>
                  Active Projects
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.statCardWrapper}>
            <TouchableOpacity
              style={styles.statCardTouchable}
              onPress={() => {
                console.log('═══════════════════════════════════════════════════════');
                console.log('📸 CAMERA CARD CLICKED - Opening Camera for Project Documentation');
                console.log('═══════════════════════════════════════════════════════');
                console.log('HomeScreen: User tapped Document Project camera card');
                console.log('HomeScreen: Navigating to /camera for project documentation');
                router.push('/camera');
                console.log('HomeScreen: Navigation to camera screen initiated');
                console.log('═══════════════════════════════════════════════════════');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, shadows.medium]}
              >
                <View style={styles.statIconContainer}>
                  <IconSymbol
                    ios_icon_name="camera.fill"
                    android_material_icon_name="camera"
                    size={28}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.statValue}>
                  📸
                </Text>
                <Text style={styles.statLabel}>
                  Document Project
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.statCardWrapper}>
            <TouchableOpacity
              style={styles.statCardTouchable}
              onPress={() => {
                console.log('HomeScreen: User tapped Time Tracking card');
                router.push('/(tabs)/time-tracking');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[themeColors.secondary, themeColors.secondaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, shadows.medium]}
              >
                <View style={styles.statIconContainer}>
                  <IconSymbol
                    ios_icon_name="clock.fill"
                    android_material_icon_name="schedule"
                    size={28}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.statValue}>
                  {stats.hoursTracked}h
                </Text>
                <Text style={styles.statLabel}>
                  Hours Tracked
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.statCardWrapper}>
            <TouchableOpacity
              style={styles.statCardTouchable}
              onPress={() => {
                console.log('═══════════════════════════════════════════════════════');
                console.log('🛍️ SHOP ITEMS CARD CLICKED - Navigating to Cart Menu');
                console.log('═══════════════════════════════════════════════════════');
                console.log('HomeScreen: User tapped Shop Items card');
                console.log('HomeScreen: Navigating to /cart-menu for order options');
                router.push('/cart-menu');
                console.log('HomeScreen: Navigation to cart menu initiated');
                console.log('═══════════════════════════════════════════════════════');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[themeColors.accent, themeColors.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, shadows.medium]}
              >
                <View style={styles.statIconContainer}>
                  <IconSymbol
                    ios_icon_name="cart.fill"
                    android_material_icon_name="shopping-cart"
                    size={28}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.statValue}>
                  {stats.shopItems}
                </Text>
                <Text style={styles.statLabel}>
                  Shop Items
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Quick Actions
          </Text>
          
          <TouchableOpacity
            style={styles.actionButtonWrapper}
            onPress={() => {
              console.log('HomeScreen: User tapped View All Projects button');
              router.push('/(tabs)/projects');
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[themeColors.gradientStart, themeColors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.actionButton, shadows.medium]}
            >
              <IconSymbol
                ios_icon_name="folder.fill"
                android_material_icon_name="folder"
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.actionButtonText}>View All Projects</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color="#FFFFFF"
              />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButtonWrapper}
            onPress={() => {
              console.log('HomeScreen: User tapped Start Timer button');
              router.push('/(tabs)/time-tracking');
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.actionButton, styles.actionButtonOutline, { borderColor: themeColors.border, backgroundColor: themeColors.card }, shadows.small]}>
              <IconSymbol
                ios_icon_name="play.circle.fill"
                android_material_icon_name="play-circle-filled"
                size={24}
                color={themeColors.primary}
              />
              <Text style={[styles.actionButtonTextOutline, { color: themeColors.text }]}>Start Timer</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={themeColors.textSecondary}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Recent Activity */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Recent Activity
          </Text>
          
          <View style={[styles.activityCard, { backgroundColor: themeColors.card }, shadows.small]}>
            <View style={[styles.activityIcon, { backgroundColor: themeColors.success + '20' }]}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color={themeColors.success}
              />
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.activityTitle, { color: themeColors.text }]}>
                Project completed
              </Text>
              <Text style={[styles.activityTime, { color: themeColors.textSecondary }]}>
                2 hours ago
              </Text>
            </View>
          </View>

          <View style={[styles.activityCard, { backgroundColor: themeColors.card }, shadows.small]}>
            <View style={[styles.activityIcon, { backgroundColor: themeColors.primary + '20' }]}>
              <IconSymbol
                ios_icon_name="clock.fill"
                android_material_icon_name="schedule"
                size={24}
                color={themeColors.primary}
              />
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.activityTitle, { color: themeColors.text }]}>
                Time tracked: 3.5 hours
              </Text>
              <Text style={[styles.activityTime, { color: themeColors.textSecondary }]}>
                Today
              </Text>
            </View>
          </View>
        </Animated.View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        )}
      </ScrollView>

      {/* Avatar Dropdown Menu */}
      <Modal
        visible={showAvatarMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAvatarMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAvatarMenu(false)}
        >
          <Animated.View
            entering={FadeInDown.springify()}
            style={[styles.dropdownMenu, { backgroundColor: themeColors.card }]}
          >
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: themeColors.border }]}
              onPress={handleProfile}
            >
              <IconSymbol
                ios_icon_name="person.circle"
                android_material_icon_name="account-circle"
                size={24}
                color={themeColors.text}
              />
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>
                Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
            >
              <IconSymbol
                ios_icon_name="arrow.right.square"
                android_material_icon_name="logout"
                size={24}
                color="#EF4444"
              />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>
                Logout
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingBottom: 120,
  },
  headerGradient: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  statCardWrapper: {
    width: (width - spacing.md * 3) / 2,
  },
  statCardTouchable: {
    width: '100%',
  },
  statCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  actionButtonWrapper: {
    marginBottom: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  actionButtonOutline: {
    borderWidth: 1.5,
  },
  actionButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  actionButtonTextOutline: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    ...typography.body,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  activityTime: {
    ...typography.bodySmall,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: spacing.md,
  },
  dropdownMenu: {
    borderRadius: borderRadius.lg,
    minWidth: 200,
    overflow: 'hidden',
    ...shadows.large,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
