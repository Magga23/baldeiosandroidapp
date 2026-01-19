
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface OrderProduct {
  id: string;
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
  source: string;
  unit: string;
  photo?: string | null;
  locationNote?: string;
  locationNotes?: Array<{ quantity: number; location: string }>;
}

interface OrderedBy {
  name: string;
  role: string;
  id: string;
  department: string;
}

interface DeliveryOptions {
  type: string;
  notes?: string;
  paymentMethod: string;
}

interface Order {
  id: string;
  order_number?: string;
  project_external_id?: string;
  project_address?: string;
  products: OrderProduct[];
  total_amount: number;
  ordered_by: OrderedBy;
  processed_by_vendor_id?: string;
  processed_by_vendor_name?: string;
  processing_type: string;
  client_id?: string;
  signature_data?: string;
  signature_captured_at?: string;
  signature_captured_by?: string;
  status: string;
  payment_status: string;
  delivery_options?: DeliveryOptions;
  created_at?: string;
}

const TVA_RATE = 0.19; // 19% TVA

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function OrderCard({ 
  order, 
  index, 
  onPress,
  themeColors,
}: { 
  order: Order; 
  index: number; 
  onPress: () => void;
  themeColors: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };

  const formatDate = () => {
    if (!order.created_at) return 'N/A';
    const date = new Date(order.created_at);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify()}
      style={animatedStyle}
    >
      <AnimatedTouchable
        style={[styles.orderCard, { backgroundColor: themeColors.card }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <View style={[styles.orderIconCircle, { backgroundColor: themeColors.primary + '20' }]}>
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={20}
                color={themeColors.primary}
              />
            </View>
            <View style={styles.orderHeaderInfo}>
              <Text style={[styles.orderNumber, { color: themeColors.text }]}>
                {order.order_number || order.id.slice(0, 8)}
              </Text>
              <Text style={[styles.orderDate, { color: themeColors.textSecondary }]}>
                {formatDate()}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
              {order.status}
            </Text>
          </View>
        </View>

        {order.project_external_id && (
          <View style={styles.orderInfo}>
            <IconSymbol
              ios_icon_name="number"
              android_material_icon_name="tag"
              size={14}
              color={themeColors.textSecondary}
            />
            <Text style={[styles.orderInfoText, { color: themeColors.textSecondary }]}>
              Project ID: {order.project_external_id}
            </Text>
          </View>
        )}

        {order.project_address && (
          <View style={styles.orderInfo}>
            <IconSymbol
              ios_icon_name="location"
              android_material_icon_name="location-on"
              size={14}
              color={themeColors.textSecondary}
            />
            <Text style={[styles.orderInfoText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {order.project_address}
            </Text>
          </View>
        )}

        {order.ordered_by && (
          <View style={styles.orderInfo}>
            <IconSymbol
              ios_icon_name="person"
              android_material_icon_name="person"
              size={14}
              color={themeColors.textSecondary}
            />
            <Text style={[styles.orderInfoText, { color: themeColors.textSecondary }]}>
              {order.ordered_by.name}
            </Text>
          </View>
        )}

        <View style={styles.orderProducts}>
          <Text style={[styles.orderProductsLabel, { color: themeColors.textSecondary }]}>
            {order.products?.length || 0} {(order.products?.length || 0) === 1 ? 'product' : 'products'}
          </Text>
        </View>

        <View style={[styles.orderFooter, { borderTopColor: themeColors.border }]}>
          <View style={styles.orderTotal}>
            <Text style={[styles.orderTotalLabel, { color: themeColors.textSecondary }]}>
              Total
            </Text>
            <Text style={[styles.orderTotalValue, { color: themeColors.primary }]}>
              {formatPrice(order.total_amount)}
            </Text>
          </View>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="arrow-forward"
            size={18}
            color={themeColors.textSecondary}
          />
        </View>
      </AnimatedTouchable>
    </Animated.View>
  );
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'delivered':
      return '#22C55E';
    case 'pending':
    case 'processing':
      return '#F59E0B';
    case 'cancelled':
      return '#EF4444';
    default:
      return '#6B7280';
  }
}

export default function OrderHistoryScreen() {
  console.log('OrderHistoryScreen: Component rendering');
  
  const theme = useTheme();
  const { user } = useAuth();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = useCallback(async () => {
    console.log('OrderHistoryScreen: Fetching orders from Supabase');
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('OrderHistoryScreen: Error fetching orders', error);
        throw error;
      }
      
      console.log('OrderHistoryScreen: Orders fetched successfully', data?.length || 0);
      
      if (data) {
        setOrders(data);
        setFilteredOrders(data);
      } else {
        setOrders([]);
        setFilteredOrders([]);
      }
    } catch (error) {
      console.error('OrderHistoryScreen: Error fetching orders', error);
      Alert.alert('Error', 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    console.log('OrderHistoryScreen: Component mounted, fetching orders');
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    console.log('OrderHistoryScreen: Search query changed, filtering');
    if (searchQuery.trim() === '') {
      setFilteredOrders(orders);
    } else {
      const filtered = orders.filter(order => {
        const searchLower = searchQuery.toLowerCase();
        return (
          order.id.toLowerCase().includes(searchLower) ||
          order.order_number?.toLowerCase().includes(searchLower) ||
          order.project_external_id?.toLowerCase().includes(searchLower) ||
          order.project_address?.toLowerCase().includes(searchLower) ||
          order.ordered_by?.name?.toLowerCase().includes(searchLower)
        );
      });
      setFilteredOrders(filtered);
    }
  }, [searchQuery, orders]);

  const onRefresh = () => {
    console.log('OrderHistoryScreen: User pulled to refresh');
    setRefreshing(true);
    fetchOrders();
  };

  const handleOrderPress = (order: Order) => {
    console.log('OrderHistoryScreen: User tapped order card', order.id);
    router.push({
      pathname: '/order-detail',
      params: { id: order.id }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Order History',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: themeColors.background,
          },
          headerTintColor: themeColors.text,
        }}
      />

      {/* Compact Header */}
      <Animated.View entering={FadeInUp.springify()}>
        <LinearGradient
          colors={[themeColors.primary, themeColors.primary + 'DD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerIconCircle}>
              <IconSymbol
                ios_icon_name="clock.fill"
                android_material_icon_name="history"
                size={24}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Order History</Text>
              <Text style={styles.headerSubtitle}>
                {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Search Bar */}
      <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: themeColors.card }]}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={themeColors.textSecondary}
          />
          <TextInput
            style={[styles.searchInput, { color: themeColors.text }]}
            placeholder="Search by order number, project, or name..."
            placeholderTextColor={themeColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={20}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Orders List */}
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
        {loading && orders.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Loading orders...
            </Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <View style={[styles.emptyState, { backgroundColor: themeColors.card }]}>
              <LinearGradient
                colors={[themeColors.primary + '20', themeColors.primary + '10']}
                style={styles.emptyIconContainer}
              >
                <IconSymbol
                  ios_icon_name="doc.text"
                  android_material_icon_name="description"
                  size={64}
                  color={themeColors.primary}
                />
              </LinearGradient>
              <Text style={[styles.emptyText, { color: themeColors.text }]}>
                {searchQuery ? 'No orders found' : 'No orders yet'}
              </Text>
              <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
                {searchQuery 
                  ? 'Try a different search term' 
                  : 'Your order history will appear here'}
              </Text>
              {searchQuery && (
                <TouchableOpacity
                  style={[styles.clearSearchButton, { backgroundColor: themeColors.primary }]}
                  onPress={() => setSearchQuery('')}
                >
                  <Text style={styles.clearSearchText}>Clear Search</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        ) : (
          <View style={styles.ordersList}>
            {filteredOrders.map((order, index) => (
              <OrderCard
                key={`order-${order.id}-${index}`}
                order={order}
                index={index}
                onPress={() => handleOrderPress(order)}
                themeColors={themeColors}
              />
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
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? 48 : spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.medium,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 140,
  },
  ordersList: {
    gap: spacing.md,
  },
  orderCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.large,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  orderIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderHeaderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  orderInfoText: {
    fontSize: 13,
    flex: 1,
  },
  orderProducts: {
    marginBottom: spacing.md,
  },
  orderProductsLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  orderTotal: {
    flex: 1,
  },
  orderTotalLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  orderTotalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  loadingText: {
    fontSize: 15,
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    ...shadows.medium,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  clearSearchButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
