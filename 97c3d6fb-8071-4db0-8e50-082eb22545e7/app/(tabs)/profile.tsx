
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  user_role: string | null;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      console.log('ProfileScreen: Fetching profile for user:', user?.id);
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, user_role')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('ProfileScreen: Error fetching profile:', error);
        return;
      }

      console.log('ProfileScreen: Profile fetched successfully:', data);
      setProfile(data);
    } catch (error) {
      console.error('ProfileScreen: Exception fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    console.log('ProfileScreen: User tapped sign out');
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            console.log('ProfileScreen: User signed out');
          },
        },
      ]
    );
  };

  const formatUserRole = (role: string | null) => {
    if (!role) return 'No role assigned';
    // Capitalize first letter of each word
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>Profile</Text>
        </View>

        {/* User Info Card */}
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <View style={[styles.avatarContainer, { backgroundColor: themeColors.primary + '20' }]}>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={48}
              color={themeColors.primary}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={themeColors.primary} style={{ marginVertical: spacing.md }} />
          ) : (
            <>
              <Text style={[styles.name, { color: themeColors.text }]}>
                {profile?.full_name || user?.email || 'No name'}
              </Text>
              <Text style={[styles.email, { color: themeColors.textSecondary }]}>
                {profile?.email || user?.email || 'No email'}
              </Text>
              
              {/* User Role Display */}
              <View style={[styles.roleContainer, { backgroundColor: themeColors.primary + '15' }]}>
                <IconSymbol
                  ios_icon_name="briefcase.fill"
                  android_material_icon_name="work"
                  size={16}
                  color={themeColors.primary}
                />
                <Text style={[styles.roleText, { color: themeColors.primary }]}>
                  {formatUserRole(profile?.user_role)}
                </Text>
              </View>

              <Text style={[styles.userId, { color: themeColors.textSecondary }]}>
                User ID: {user?.id?.substring(0, 8)}...
              </Text>
            </>
          )}
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Settings
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: themeColors.card }]}
            onPress={() => {
              console.log('ProfileScreen: User tapped edit profile');
              Alert.alert('Coming Soon', 'Profile editing will be available soon!');
            }}
          >
            <View style={styles.settingLeft}>
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={24}
                color={themeColors.text}
              />
              <Text style={[styles.settingText, { color: themeColors.text }]}>
                Edit Profile
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: themeColors.card }]}
            onPress={() => {
              console.log('ProfileScreen: User tapped notifications');
              Alert.alert('Coming Soon', 'Notification settings will be available soon!');
            }}
          >
            <View style={styles.settingLeft}>
              <IconSymbol
                ios_icon_name="bell.fill"
                android_material_icon_name="notifications"
                size={24}
                color={themeColors.text}
              />
              <Text style={[styles.settingText, { color: themeColors.text }]}>
                Notifications
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: themeColors.card }]}
            onPress={() => {
              console.log('ProfileScreen: User tapped privacy');
              Alert.alert('Coming Soon', 'Privacy settings will be available soon!');
            }}
          >
            <View style={styles.settingLeft}>
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={24}
                color={themeColors.text}
              />
              <Text style={[styles.settingText, { color: themeColors.text }]}>
                Privacy
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: themeColors.error + '20' }]}
          onPress={handleSignOut}
        >
          <IconSymbol
            ios_icon_name="rectangle.portrait.and.arrow.right"
            android_material_icon_name="logout"
            size={24}
            color={themeColors.error}
          />
          <Text style={[styles.signOutText, { color: themeColors.error }]}>
            Sign Out
          </Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appInfoText, { color: themeColors.textSecondary }]}>
            BALDE Mobile v1.0.0
          </Text>
          <Text style={[styles.appInfoText, { color: themeColors.textSecondary }]}>
            Powered by Supabase
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 120,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
  },
  card: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  name: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  roleText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  userId: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingText: {
    ...typography.body,
  },
  signOutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  signOutText: {
    ...typography.body,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  appInfoText: {
    ...typography.caption,
  },
});
