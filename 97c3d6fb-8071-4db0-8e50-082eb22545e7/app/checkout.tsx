
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import SignatureCanvas from '@/components/SignatureCanvas';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CartItem {
  id: string;
  name: string;
  sale_price: number;
  cartQuantity: number;
  product_id: string | null;
  source: string;
  unit: string | null;
  photo: string | null;
  locationNote?: string;
  locationNotes?: Array<{ quantity: number; location: string }>;
}

interface Project {
  id: string;
  external_id: string;
  address: string;
  zipcode: string;
  city: string;
  plz?: string;
  stadt?: string;
  stockwerk?: string;
  wohnungs_id?: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  position: string;
}

const CART_STORAGE_KEY = '@shop_cart';
const TVA_RATE = 0.19; // 19% VAT

const ROOM_OPTIONS = [
  { value: 'kitchen', label: 'Küche' },
  { value: 'living_room', label: 'Wohnzimmer' },
  { value: 'bedroom', label: 'Schlafzimmer' },
  { value: 'kinderzimmer', label: 'Kinderzimmer' },
  { value: 'bathroom', label: 'Badezimmer' },
  { value: 'guest_wc', label: 'Gäste WC' },
  { value: 'hallway', label: 'Flur' },
  { value: 'entrance', label: 'Wohnungseingangtür' },
  { value: 'office', label: 'Büro' },
  { value: 'dining_room', label: 'Esszimmer' },
  { value: 'balcony', label: 'Balkon' },
  { value: 'basement', label: 'Keller' },
  { value: 'attic', label: 'Dachboden' },
  { value: 'garage', label: 'Garage' },
  { value: 'other', label: 'Sonstiges' },
];

export default function CheckoutScreen() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('💳 CHECKOUT SCREEN - Rendering comprehensive checkout page');
  console.log('═══════════════════════════════════════════════════════');

  const theme = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);

  // Delivery and payment options
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>(
    (params.deliveryMode as 'pickup' | 'delivery') || 'pickup'
  );
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'invoice'>('invoice');

  // Signature
  const [signatureData, setSignatureData] = useState('');

  // Get params from navigation
  const projectId = params.projectId as string;
  const projectExternalId = params.projectExternalId as string;
  const employeeId = params.employeeId as string;
  const employeeName = params.employeeName as string;

  console.log('CheckoutScreen: Received params:', {
    projectId,
    projectExternalId,
    employeeId,
    employeeName,
    deliveryMode: params.deliveryMode,
  });

  useEffect(() => {
    console.log('CheckoutScreen: Loading cart and fetching project/employee details');
    loadCartFromStorage();
    if (projectId) {
      fetchProjectDetails();
    }
    if (employeeId) {
      fetchEmployeeDetails();
    }
  }, []);

  const loadCartFromStorage = async () => {
    console.log('CheckoutScreen: Loading cart from storage');
    try {
      const cartData = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (cartData) {
        const parsedCart = JSON.parse(cartData);
        console.log('CheckoutScreen: Cart loaded from storage', parsedCart.length);
        setCart(parsedCart);
      } else {
        console.log('CheckoutScreen: No cart data found in storage');
        Alert.alert('Empty Cart', 'Your cart is empty. Please add items first.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('CheckoutScreen: Error loading cart from storage', error);
    }
  };

  const fetchProjectDetails = async () => {
    console.log('CheckoutScreen: Fetching project details for ID:', projectId);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      console.log('CheckoutScreen: ✅ Project details fetched');
      setProject(data);
    } catch (error) {
      console.error('CheckoutScreen: ❌ Error fetching project details', error);
    }
  };

  const fetchEmployeeDetails = async () => {
    console.log('CheckoutScreen: Fetching employee details for ID:', employeeId);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (error) throw error;

      console.log('CheckoutScreen: ✅ Employee details fetched');
      setEmployee(data);
    } catch (error) {
      console.error('CheckoutScreen: ❌ Error fetching employee details', error);
    }
  };

  const getLocationLabel = (locationValue: string) => {
    const room = ROOM_OPTIONS.find(r => r.value === locationValue);
    return room ? room.label : locationValue;
  };

  const createOrder = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📝 CREATING ORDER - User clicked Sign & Confirm');
    console.log('═══════════════════════════════════════════════════════');

    if (!signatureData) {
      Alert.alert('Signature Required', 'Please provide your signature to confirm the order');
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Cannot create order with empty cart');
      return;
    }

    try {
      setLoading(true);

      // Generate order ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const orderId = `ORD-${timestamp}-${random}`;

      console.log('CheckoutScreen: Generated order ID:', orderId);

      // Prepare products array with location data
      const products = cart.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        name: item.name,
        price: item.sale_price,
        quantity: item.cartQuantity,
        source: item.source,
        unit: item.unit || 'Stück',
        photo: item.photo,
        locationNote: item.locationNote,
        locationNotes: item.locationNotes,
      }));

      console.log('CheckoutScreen: Products with location data:', products);

      // Calculate totals
      const nettoAmount = cart.reduce((sum, item) => sum + item.sale_price * item.cartQuantity, 0);
      const tvaAmount = nettoAmount * TVA_RATE;
      const bruttoAmount = nettoAmount + tvaAmount;

      console.log('CheckoutScreen: Order totals:', {
        netto: nettoAmount,
        tva: tvaAmount,
        brutto: bruttoAmount,
      });

      // Get full project address - Only address, zip code, and city
      const projectAddress = project
        ? `${project.address}, ${project.zipcode || project.plz || ''} ${project.city || project.stadt || ''}`.trim()
        : projectExternalId || 'N/A';

      // Prepare order data
      const orderData = {
        id: orderId,
        order_number: orderId,
        project_id: projectId,
        project_external_id: project?.external_id || projectExternalId,
        project_address: projectAddress,
        products: products,
        total_amount: bruttoAmount,
        netto_amount: nettoAmount,
        tva_amount: tvaAmount,
        ordered_by: {
          name: employee ? `${employee.first_name} ${employee.last_name}` : employeeName || 'Unknown',
          role: employee?.role || 'N/A',
          id: employee?.id || employeeId,
          department: employee?.position || 'N/A',
        },
        processed_by_vendor_id: user?.id,
        processed_by_vendor_name: user?.email || 'System',
        processing_type: 'terminal',
        delivery_options: {
          type: deliveryType,
          notes: notes,
          paymentMethod: paymentMethod,
        },
        signature_data: signatureData,
        signature_captured_at: new Date().toISOString(),
        signature_captured_by: user?.id || 'system',
        status: 'pending',
        payment_status: 'offen',
        created_at: new Date().toISOString(),
      };

      console.log('CheckoutScreen: Submitting order to Supabase');

      // Create order in Supabase
      const { data, error } = await supabase.from('orders').insert([orderData]).select().single();

      if (error) throw error;

      console.log('CheckoutScreen: ✅ Order created successfully', data.id);

      // Check if any products require Zulage and create notification
      const zulageProducts = cart.filter(item => {
        // Check if product has location data (indicates zulage_required)
        return item.locationNote || (item.locationNotes && item.locationNotes.length > 0);
      });

      if (zulageProducts.length > 0) {
        console.log('CheckoutScreen: Creating Zulage notification for', zulageProducts.length, 'products');
        
        const zulageNotification = {
          order_id: orderId,
          project_id: projectId,
          product_ids: zulageProducts.map(p => p.product_id).filter(Boolean),
          status: 'pending',
          created_at: new Date().toISOString(),
        };

        const { error: notificationError } = await supabase
          .from('product_zulage_notifications')
          .insert([zulageNotification]);

        if (notificationError) {
          console.error('CheckoutScreen: ❌ Error creating Zulage notification', notificationError);
        } else {
          console.log('CheckoutScreen: ✅ Zulage notification created');
        }
      }

      // Clear cart from storage
      await AsyncStorage.removeItem(CART_STORAGE_KEY);

      Alert.alert('Order Placed!', `Your order ${orderId} has been placed successfully.`, [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)/shop'),
        },
      ]);
    } catch (error) {
      console.error('CheckoutScreen: ❌ Error creating order', error);
      Alert.alert('Error', 'Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.sale_price * item.cartQuantity, 0);
  };

  const calculateNetto = () => {
    return getCartTotal();
  };

  const calculateTVA = () => {
    return calculateNetto() * TVA_RATE;
  };

  const calculateBrutto = () => {
    return calculateNetto() + calculateTVA();
  };

  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };

  const getFullAddress = () => {
    if (!project) return projectExternalId || 'N/A';
    
    // Only show address, zip code, and city (no floor or apartment)
    const parts = [
      project.address,
      `${project.zipcode || project.plz || ''} ${project.city || project.stadt || ''}`.trim(),
    ].filter(Boolean);
    
    return parts.join(', ');
  };

  console.log('CheckoutScreen: Rendering checkout page with', cart.length, 'items');

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Checkout',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: themeColors.background,
          },
          headerTintColor: themeColors.text,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Project Information */}
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={[themeColors.primary, themeColors.primary + 'DD']}
                style={styles.sectionIconContainer}
              >
                <IconSymbol
                  ios_icon_name="building.2"
                  android_material_icon_name="business"
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Project Information</Text>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Project ID:</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>
                  {project?.external_id || projectExternalId || 'N/A'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Address:</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>{getFullAddress()}</Text>
              </View>
              {project?.status && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: themeColors.primary + '20' }]}>
                    <Text style={[styles.statusText, { color: themeColors.primary }]}>
                      {project.status}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Orderer Information */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.sectionIconContainer}
              >
                <IconSymbol
                  ios_icon_name="person.circle"
                  android_material_icon_name="person"
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Ordered By</Text>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Name:</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>
                  {employee ? `${employee.first_name} ${employee.last_name}` : employeeName || 'N/A'}
                </Text>
              </View>
              {employee?.role && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Role:</Text>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>{employee.role}</Text>
                </View>
              )}
              {employee?.position && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Position:</Text>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>{employee.position}</Text>
                </View>
              )}
              {employee?.email && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Email:</Text>
                  <Text style={[styles.infoValue, { color: themeColors.text }]}>{employee.email}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Order Processed By */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.sectionIconContainer}
              >
                <IconSymbol
                  ios_icon_name="checkmark.seal.fill"
                  android_material_icon_name="verified"
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Processed By</Text>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>User:</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>
                  {user?.email || 'System'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>User ID:</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>
                  {user?.id || 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Product List */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                style={styles.sectionIconContainer}
              >
                <IconSymbol
                  ios_icon_name="cart.fill"
                  android_material_icon_name="shopping-cart"
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Products</Text>
            </View>
            <View style={styles.sectionContent}>
              {cart.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.productItem,
                    index < cart.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: themeColors.border,
                    },
                  ]}
                >
                  {/* Product Image */}
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={styles.productImage} resizeMode="cover" />
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

                  {/* Product Details */}
                  <View style={styles.productDetails}>
                    <Text style={[styles.productName, { color: themeColors.text }]}>{item.name}</Text>
                    <Text style={[styles.productUnit, { color: themeColors.textSecondary }]}>
                      {item.unit || 'Stück'}
                    </Text>
                    
                    {/* Location Information - Display ALL locations as badges */}
                    {(item.locationNote || (item.locationNotes && item.locationNotes.length > 0)) && (
                      <View style={styles.locationInfoContainer}>
                        <View style={[styles.locationHeaderBadge, { backgroundColor: '#F59E0B' + '20' }]}>
                          <IconSymbol
                            ios_icon_name="location.fill"
                            android_material_icon_name="location-on"
                            size={12}
                            color="#F59E0B"
                          />
                          <Text style={[styles.locationHeaderText, { color: '#F59E0B' }]}>
                            Installation Location
                          </Text>
                        </View>
                        
                        {/* Display all locations as badges */}
                        <View style={styles.locationBadgesContainer}>
                          {item.locationNote ? (
                            // Single location badge
                            <View style={[styles.locationBadge, { backgroundColor: '#F59E0B' }]}>
                              <IconSymbol
                                ios_icon_name="location.fill"
                                android_material_icon_name="location-on"
                                size={10}
                                color="#FFFFFF"
                              />
                              <Text style={styles.locationBadgeText}>
                                {getLocationLabel(item.locationNote)}
                              </Text>
                            </View>
                          ) : (
                            // Multiple location badges
                            item.locationNotes?.map((loc, locIndex) => (
                              <View key={locIndex} style={[styles.locationBadge, { backgroundColor: '#F59E0B' }]}>
                                <IconSymbol
                                  ios_icon_name="location.fill"
                                  android_material_icon_name="location-on"
                                  size={10}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.locationBadgeText}>
                                  {getLocationLabel(loc.location)}
                                </Text>
                              </View>
                            ))
                          )}
                        </View>
                      </View>
                    )}
                    
                    <View style={styles.productPriceRow}>
                      <Text style={[styles.productPrice, { color: themeColors.primary }]}>
                        {formatPrice(item.sale_price)}
                      </Text>
                      <Text style={[styles.productQuantity, { color: themeColors.textSecondary }]}>
                        × {item.cartQuantity}
                      </Text>
                    </View>
                  </View>

                  {/* Product Total */}
                  <View style={styles.productTotalContainer}>
                    <Text style={[styles.productTotal, { color: themeColors.text }]}>
                      {formatPrice(item.sale_price * item.cartQuantity)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Total Breakdown */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.sectionIconContainer}
              >
                <IconSymbol
                  ios_icon_name="eurosign.circle.fill"
                  android_material_icon_name="euro"
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Total Breakdown</Text>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: themeColors.textSecondary }]}>Netto:</Text>
                <Text style={[styles.totalValue, { color: themeColors.text }]}>
                  {formatPrice(calculateNetto())}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: themeColors.textSecondary }]}>
                  TVA (19%):
                </Text>
                <Text style={[styles.totalValue, { color: themeColors.text }]}>
                  {formatPrice(calculateTVA())}
                </Text>
              </View>
              <View style={[styles.totalRow, styles.totalRowFinal]}>
                <Text style={[styles.totalLabelFinal, { color: themeColors.text }]}>Brutto:</Text>
                <Text style={[styles.totalValueFinal, { color: themeColors.primary }]}>
                  {formatPrice(calculateBrutto())}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Delivery Term */}
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={deliveryType === 'pickup' ? ['#10B981', '#059669'] : ['#6366F1', '#8B5CF6']}
                style={styles.sectionIconContainer}
              >
                <IconSymbol
                  ios_icon_name={deliveryType === 'pickup' ? 'bag.fill' : 'shippingbox.fill'}
                  android_material_icon_name={
                    deliveryType === 'pickup' ? 'shopping-bag' : 'local-shipping'
                  }
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Delivery Term</Text>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    { backgroundColor: themeColors.background },
                    deliveryType === 'pickup' && {
                      backgroundColor: '#10B981',
                    },
                  ]}
                  onPress={() => {
                    console.log('CheckoutScreen: User selected Pick Up');
                    setDeliveryType('pickup');
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: themeColors.text },
                      deliveryType === 'pickup' && { color: '#FFFFFF' },
                    ]}
                  >
                    Pick Up
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    { backgroundColor: themeColors.background },
                    deliveryType === 'delivery' && {
                      backgroundColor: '#6366F1',
                    },
                  ]}
                  onPress={() => {
                    console.log('CheckoutScreen: User selected Delivery');
                    setDeliveryType('delivery');
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: themeColors.text },
                      deliveryType === 'delivery' && { color: '#FFFFFF' },
                    ]}
                  >
                    Delivery
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Payment Method */}
        <Animated.View entering={FadeInDown.delay(600).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.sectionIconContainer}
              >
                <IconSymbol
                  ios_icon_name="creditcard.fill"
                  android_material_icon_name="payment"
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Payment Method</Text>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.optionsRow}>
                {(['cash', 'card', 'invoice'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.optionButton,
                      { backgroundColor: themeColors.background },
                      paymentMethod === method && {
                        backgroundColor: themeColors.primary,
                      },
                    ]}
                    onPress={() => {
                      console.log('CheckoutScreen: User selected payment method:', method);
                      setPaymentMethod(method);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: themeColors.text },
                        paymentMethod === method && { color: '#FFFFFF' },
                      ]}
                    >
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Notes */}
        <Animated.View entering={FadeInDown.delay(700).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.sectionIconContainer}
              >
                <IconSymbol
                  ios_icon_name="note.text"
                  android_material_icon_name="description"
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Notes</Text>
            </View>
            <View style={styles.sectionContent}>
              <TextInput
                style={[
                  styles.notesInput,
                  { backgroundColor: themeColors.background, color: themeColors.text },
                ]}
                placeholder="Add any notes or special instructions..."
                placeholderTextColor={themeColors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </Animated.View>

        {/* Signature */}
        <Animated.View entering={FadeInDown.delay(800).springify()}>
          <View style={[styles.section, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.sectionIconContainer}
              >
                <IconSymbol
                  ios_icon_name="signature"
                  android_material_icon_name="edit"
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Signature</Text>
            </View>
            <View style={styles.sectionContent}>
              <Text style={[styles.signatureLabel, { color: themeColors.textSecondary }]}>
                Please sign below to confirm your order
              </Text>
              <SignatureCanvas
                onSignatureChange={setSignatureData}
                backgroundColor={themeColors.background}
                strokeColor={themeColors.text}
              />
            </View>
          </View>
        </Animated.View>

        {/* Sign & Confirm Button */}
        <Animated.View entering={FadeInDown.delay(900).springify()}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              { backgroundColor: themeColors.primary },
              (!signatureData || loading) && styles.confirmButtonDisabled,
              shadows.large,
            ]}
            onPress={createOrder}
            disabled={!signatureData || loading}
          >
            <LinearGradient
              colors={
                !signatureData || loading
                  ? [themeColors.border, themeColors.border]
                  : [themeColors.primary, themeColors.primary + 'DD']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="checkmark.seal.fill"
                    android_material_icon_name="check-circle"
                    size={28}
                    color="#FFFFFF"
                  />
                  <Text style={styles.confirmButtonText}>Sign & Confirm Order</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
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
    padding: spacing.lg,
    paddingBottom: 100,
  },
  section: {
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  sectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionContent: {
    padding: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
  },
  productImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  productUnit: {
    fontSize: 12,
    marginBottom: 4,
  },
  locationInfoContainer: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  locationHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  locationHeaderText: {
    fontSize: 10,
    fontWeight: '600',
  },
  locationBadgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  locationBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  productQuantity: {
    fontSize: 13,
  },
  productTotalContainer: {
    alignItems: 'flex-end',
  },
  productTotal: {
    fontSize: 16,
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalRowFinal: {
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    marginTop: spacing.sm,
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: '800',
  },
  totalValueFinal: {
    fontSize: 22,
    fontWeight: '900',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.small,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  notesInput: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 15,
    minHeight: 100,
    ...shadows.small,
  },
  signatureLabel: {
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  confirmButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
});
