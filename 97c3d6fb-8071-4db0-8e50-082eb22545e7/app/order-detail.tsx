
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';

interface OrderProduct {
  id: string;
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
  source: string;
  unit: string;
  photo?: string | null;
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

export default function OrderDetailScreen() {
  console.log('OrderDetailScreen: Component rendering');
  
  const theme = useTheme();
  const params = useLocalSearchParams();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);

  const orderId = params.id as string;

  const fetchOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (error) {
        console.error('OrderDetailScreen: Error fetching order', error);
        throw error;
      }
      
      console.log('OrderDetailScreen: Order loaded successfully');
      
      // Fetch product photos for each product if product_id exists
      if (data && data.products) {
        const productsWithPhotos = await Promise.all(
          data.products.map(async (product: OrderProduct) => {
            if (product.product_id) {
              const { data: productData } = await supabase
                .from('products')
                .select('photo')
                .eq('id', product.product_id)
                .single();
              
              return {
                ...product,
                photo: productData?.photo || null,
              };
            }
            return product;
          })
        );
        
        data.products = productsWithPhotos;
      }
      
      setOrder(data);
    } catch (error) {
      console.error('OrderDetailScreen: Error fetching order details', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    console.log('OrderDetailScreen: Fetching order details for ID:', orderId);
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'cancelled':
        return '#EF4444';
      default:
        return themeColors.textSecondary;
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'bezahlt':
        return '#10B981';
      case 'offen':
        return '#F59E0B';
      case 'teilzahlung':
        return '#3B82F6';
      case 'storniert':
        return '#EF4444';
      default:
        return themeColors.textSecondary;
    }
  };

  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };

  const calculateNettoAmount = (totalAmount: number) => {
    // Total amount is netto, so return as is
    return totalAmount;
  };

  const calculateTVAAmount = (nettoAmount: number) => {
    return nettoAmount * TVA_RATE;
  };

  const calculateBruttoAmount = (nettoAmount: number) => {
    return nettoAmount * (1 + TVA_RATE);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Order Details',
            headerBackTitle: 'Back',
            headerStyle: {
              backgroundColor: themeColors.background,
            },
            headerTintColor: themeColors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading order details...
          </Text>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Order Details',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: themeColors.text }]}>
            Order not found
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: themeColors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const nettoAmount = calculateNettoAmount(order.total_amount);
  const tvaAmount = calculateTVAAmount(nettoAmount);
  const bruttoAmount = calculateBruttoAmount(nettoAmount);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Order Details',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: themeColors.background,
          },
          headerTintColor: themeColors.text,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Header */}
        <Animated.View entering={FadeInUp.springify()}>
          <LinearGradient
            colors={[themeColors.primary, themeColors.primary + 'DD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
          >
            <View style={styles.headerIconContainer}>
              <IconSymbol
                ios_icon_name="doc.text.fill"
                android_material_icon_name="receipt"
                size={40}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.headerTitle}>
              {order.order_number || order.id.slice(0, 8)}
            </Text>
            <Text style={styles.headerSubtitle}>
              {formatDate(order.created_at)}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Status Section */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              Order Status
            </Text>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <Text style={[styles.statusLabel, { color: themeColors.textSecondary }]}>
                  Order Status
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.statusItem}>
                <Text style={[styles.statusLabel, { color: themeColors.textSecondary }]}>
                  Payment Status
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getPaymentStatusColor(order.payment_status) + '20' }]}>
                  <View style={[styles.statusDot, { backgroundColor: getPaymentStatusColor(order.payment_status) }]} />
                  <Text style={[styles.statusText, { color: getPaymentStatusColor(order.payment_status) }]}>
                    {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Project Information */}
        {(order.project_external_id || order.project_address) && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <View style={[styles.section, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Project Information
              </Text>
              {order.project_external_id && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconContainer, { backgroundColor: themeColors.primary + '15' }]}>
                    <IconSymbol
                      ios_icon_name="building.2"
                      android_material_icon_name="business"
                      size={18}
                      color={themeColors.primary}
                    />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                      Project ID
                    </Text>
                    <Text style={[styles.infoValue, { color: themeColors.text }]}>
                      {order.project_external_id}
                    </Text>
                  </View>
                </View>
              )}
              {order.project_address && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconContainer, { backgroundColor: '#8B5CF6' + '15' }]}>
                    <IconSymbol
                      ios_icon_name="location"
                      android_material_icon_name="location-on"
                      size={18}
                      color="#8B5CF6"
                    />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                      Address
                    </Text>
                    <Text style={[styles.infoValue, { color: themeColors.text }]}>
                      {order.project_address}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Ordered By */}
        {order.ordered_by && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <View style={[styles.section, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Ordered By
              </Text>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: '#10B981' + '15' }]}>
                  <IconSymbol
                    ios_icon_name="person.circle"
                    android_material_icon_name="person"
                    size={18}
                    color="#10B981"
                  />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>
                    {order.ordered_by.name}
                  </Text>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                    {order.ordered_by.role} • {order.ordered_by.department}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Products */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              Order Items ({order.products?.length || 0})
            </Text>
            {order.products && order.products.map((product, index) => (
              <View key={`product-${index}`} style={[styles.productItem, { borderBottomColor: themeColors.border }]}>
                {/* Product Image */}
                {product.photo ? (
                  <Image
                    source={{ uri: product.photo }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.productImagePlaceholder, { backgroundColor: themeColors.border }]}>
                    <IconSymbol
                      ios_icon_name="photo"
                      android_material_icon_name="image"
                      size={24}
                      color={themeColors.textSecondary}
                    />
                  </View>
                )}
                
                <View style={styles.productInfo}>
                  <Text style={[styles.productName, { color: themeColors.text }]}>
                    {product.name}
                  </Text>
                  <Text style={[styles.productMeta, { color: themeColors.textSecondary }]}>
                    Qty: {product.quantity} • {product.unit}
                  </Text>
                </View>
                <Text style={[styles.productPrice, { color: themeColors.primary }]}>
                  {formatPrice(product.price * product.quantity)}
                </Text>
              </View>
            ))}
            
            {/* Netto, TVA, Brutto breakdown */}
            <View style={[styles.amountBreakdown, { borderTopColor: themeColors.border }]}>
              <View style={styles.amountRow}>
                <Text style={[styles.amountLabel, { color: themeColors.textSecondary }]}>
                  Netto Amount
                </Text>
                <Text style={[styles.amountValue, { color: themeColors.text }]}>
                  {formatPrice(nettoAmount)}
                </Text>
              </View>
              
              <View style={styles.amountRow}>
                <Text style={[styles.amountLabel, { color: themeColors.textSecondary }]}>
                  TVA (19%)
                </Text>
                <Text style={[styles.amountValue, { color: themeColors.text }]}>
                  {formatPrice(tvaAmount)}
                </Text>
              </View>
              
              <View style={[styles.totalRow, { borderTopColor: themeColors.border }]}>
                <Text style={[styles.totalLabel, { color: themeColors.text }]}>
                  Brutto Amount
                </Text>
                <LinearGradient
                  colors={[themeColors.primary, themeColors.primary + 'DD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.totalBadge}
                >
                  <Text style={styles.totalAmount}>
                    {formatPrice(bruttoAmount)}
                  </Text>
                </LinearGradient>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Delivery Options */}
        {order.delivery_options && (
          <Animated.View entering={FadeInDown.delay(500).springify()}>
            <View style={[styles.section, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Delivery Information
              </Text>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: '#F59E0B' + '15' }]}>
                  <IconSymbol
                    ios_icon_name="shippingbox"
                    android_material_icon_name="local-shipping"
                    size={18}
                    color="#F59E0B"
                  />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                    Delivery Type
                  </Text>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>
                    {order.delivery_options.type === 'pickup' ? 'Pickup' : 'Delivery'}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: '#3B82F6' + '15' }]}>
                  <IconSymbol
                    ios_icon_name="creditcard"
                    android_material_icon_name="payment"
                    size={18}
                    color="#3B82F6"
                  />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                    Payment Method
                  </Text>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>
                    {order.delivery_options.paymentMethod.charAt(0).toUpperCase() + order.delivery_options.paymentMethod.slice(1)}
                  </Text>
                </View>
              </View>
              {order.delivery_options.notes && (
                <View style={[styles.notesContainer, { backgroundColor: themeColors.background + '80' }]}>
                  <Text style={[styles.notesLabel, { color: themeColors.textSecondary }]}>
                    Notes:
                  </Text>
                  <Text style={[styles.notesText, { color: themeColors.text }]}>
                    {order.delivery_options.notes}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Signature */}
        {order.signature_data && (
          <Animated.View entering={FadeInDown.delay(600).springify()}>
            <View style={[styles.section, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Signature
              </Text>
              <Image
                source={{ uri: order.signature_data }}
                style={styles.signatureImage}
                resizeMode="contain"
              />
              {order.signature_captured_at && (
                <Text style={[styles.signatureDate, { color: themeColors.textSecondary }]}>
                  Signed on {formatDate(order.signature_captured_at)}
                </Text>
              )}
            </View>
          </Animated.View>
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
    paddingTop: Platform.OS === 'android' ? 48 : spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: 15,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.large,
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  section: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusItem: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  productMeta: {
    fontSize: 12,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  amountBreakdown: {
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 2,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 2,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  totalBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  notesContainer: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  signatureImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    backgroundColor: '#F3F4F6',
  },
  signatureDate: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
