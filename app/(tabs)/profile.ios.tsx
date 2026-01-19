
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  user_role: string | null;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      console.log('ProfileScreen (iOS): Fetching profile for user:', user?.id);
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, user_role')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('ProfileScreen (iOS): Error fetching profile:', error);
        return;
      }

      console.log('ProfileScreen (iOS): Profile fetched successfully:', data);
      setProfile(data);
    } catch (error) {
      console.error('ProfileScreen (iOS): Exception fetching profile:', error);
    } finally {
      setLoading(false);
    }
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <GlassView style={styles.profileHeader} glassEffectStyle="regular">
          <IconSymbol ios_icon_name="person.circle.fill" android_material_icon_name="person" size={80} color={theme.colors.primary} />
          
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <>
              <Text style={[styles.name, { color: theme.colors.text }]}>
                {profile?.full_name || user?.email || 'No name'}
              </Text>
              <Text style={[styles.email, { color: theme.dark ? '#98989D' : '#666' }]}>
                {profile?.email || user?.email || 'No email'}
              </Text>
              
              {/* User Role Display */}
              <View style={[styles.roleContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                <IconSymbol
                  ios_icon_name="briefcase.fill"
                  android_material_icon_name="work"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={[styles.roleText, { color: theme.colors.primary }]}>
                  {formatUserRole(profile?.user_role)}
                </Text>
              </View>
            </>
          )}
        </GlassView>

        <GlassView style={styles.section} glassEffectStyle="regular">
          <View style={styles.infoRow}>
            <IconSymbol ios_icon_name="envelope.fill" android_material_icon_name="email" size={24} color={theme.dark ? '#98989D' : '#666'} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              {profile?.email || user?.email || 'No email'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <IconSymbol ios_icon_name="person.text.rectangle" android_material_icon_name="badge" size={24} color={theme.dark ? '#98989D' : '#666'} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              ID: {user?.id?.substring(0, 8)}...
            </Text>
          </View>
        </GlassView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  profileHeader: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    gap: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 16,
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 16,
  },
});
