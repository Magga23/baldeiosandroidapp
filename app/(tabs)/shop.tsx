
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';

export default function ShopScreen() {
  console.log('ShopScreen: Rendering POS redirect screen');
  const theme = useTheme();
  const { user } = useAuth();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [loading, setLoading] = useState(false);

  const handleNavigateToPOS = () => {
    console.log('ShopScreen: User tapped Navigate to POS button');
    console.log('ShopScreen: Redirecting to cart-menu (POS entry point)');
    router.push('/cart-menu');
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with gradient background */}
        <LinearGradient
          colors={[themeColors.primary, themeColors.primary + 'DD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>BALDE Shop</Text>
              <Text style={styles.headerSubtitle}>Point of Sale System</Text>
            </View>
          </View>
        </LinearGradient>

        {/* POS Redirect Card */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={[styles.redirectCard, { backgroundColor: themeColors.card }]}>
            <LinearGradient
              colors={[themeColors.primary + '20', themeColors.primary + '10']}
              style={styles.redirectIconContainer}
            >
              <IconSymbol
                ios_icon_name="cart.fill"
                android_material_icon_name="shopping-cart"
                size={64}
                color={themeColors.primary}
              />
            </LinearGradient>
            
            <Text style={[styles.redirectTitle, { color: themeColors.text }]}>
              Welcome to BALDE POS
            </Text>
            
            <Text style={[styles.redirectDescription, { color: themeColors.textSecondary }]}>
              Our Point of Sale system has been integrated for better order management and tracking.
            </Text>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <View style={[styles.featureIconBadge, { backgroundColor: themeColors.primary + '20' }]}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={20}
                    color={themeColors.primary}
                  />
                </View>
                <Text style={[styles.featureText, { color: themeColors.text }]}>
                  Project-based ordering
                </Text>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIconBadge, { backgroundColor: themeColors.primary + '20' }]}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={20}
                    color={themeColors.primary}
                  />
                </View>
                <Text style={[styles.featureText, { color: themeColors.text }]}>
                  Employee identification
                </Text>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIconBadge, { backgroundColor: themeColors.primary + '20' }]}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={20}
                    color={themeColors.primary}
                  />
                </View>
                <Text style={[styles.featureText, { color: themeColors.text }]}>
                  QR code scanning
                </Text>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIconBadge, { backgroundColor: themeColors.primary + '20' }]}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={20}
                    color={themeColors.primary}
                  />
                </View>
                <Text style={[styles.featureText, { color: themeColors.text }]}>
                  Order history & tracking
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.posButton, { backgroundColor: themeColors.primary }]}
              onPress={handleNavigateToPOS}
              disabled={loading}
            >
              <LinearGradient
                colors={[themeColors.primary, themeColors.primary + 'DD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.posButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="cart.fill"
                      android_material_icon_name="shopping-cart"
                      size={24}
                      color="#FFFFFF"
                    />
                    <Text style={styles.posButtonText}>Go to POS System</Text>
                    <IconSymbol
                      ios_icon_name="arrow.right"
                      android_material_icon_name="arrow-forward"
                      size={24}
                      color="#FFFFFF"
                    />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Quick Actions
          </Text>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: themeColors.card }]}
            onPress={() => {
              console.log('ShopScreen: User tapped Order History quick action');
              router.push('/order-history');
            }}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: '#6366F1' + '20' }]}>
              <IconSymbol
                ios_icon_name="clock.fill"
                android_material_icon_name="history"
                size={28}
                color="#6366F1"
              />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: themeColors.text }]}>
                Order History
              </Text>
              <Text style={[styles.actionDescription, { color: themeColors.textSecondary }]}>
                View your past orders and their status
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Info Card */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <View style={[styles.infoCard, { backgroundColor: themeColors.primary + '15' }]}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={24}
              color={themeColors.primary}
            />
            <Text style={[styles.infoText, { color: themeColors.text }]}>
              The POS system provides a streamlined ordering experience with project tracking and employee authentication.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? 48 : 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  redirectCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadows.large,
  },
  redirectIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  redirectTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  redirectDescription: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  featuresList: {
    width: '100%',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  posButton: {
    width: '100%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.large,
  },
  posButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  posButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    gap: spacing.md,
    ...shadows.medium,
  },
  actionIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
