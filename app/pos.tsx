
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Product {
  id: string;
  name: string;
  sale_price: number;
  unit: string | null;
  photo: string | null;
  trade: string | null;
  description: string | null;
  quantity: number | null;
  qr_code?: string | null;
  zulage_required?: boolean;
}

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

const CART_STORAGE_KEY = '@shop_cart';

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

export default function POSScreen() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🛒 POS SCREEN - Component is rendering');
  console.log('═══════════════════════════════════════════════════════');

  const theme = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<'pickup' | 'delivery'>('pickup');
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  
  // Gewerke filter state
  const [selectedGewerke, setSelectedGewerke] = useState<string | null>(null);
  const [availableGewerke, setAvailableGewerke] = useState<string[]>([]);
  
  // Product description modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Quantity selector modal
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityModalProduct, setQuantityModalProduct] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [quantityInputText, setQuantityInputText] = useState('1');
  
  // Zulage location selection
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locationAssignments, setLocationAssignments] = useState<Array<{ quantity: number; location: string }>>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  
  // QR Scanner state
  const [showQRScanner, setShowQRScanner] = useState(false);
   const [scanned, setScanned] = useState(false);
  
  // Project info
  const [project, setProject] = useState<Project | null>(null);

  // Get params from navigation
  const projectId = params.projectId as string;
  const projectExternalId = params.projectExternalId as string;
  const employeeId = params.employeeId as string;
  const employeeName = params.employeeName as string;

  console.log('POSScreen: Received params:', {
    projectId,
    projectExternalId,
    employeeId,
    employeeName,
  });

  useEffect(() => {
    console.log('POSScreen: useEffect triggered - loading products, cart, and project details');
    fetchProducts();
    loadCartFromStorage();
    if (projectId) {
      fetchProjectDetails();
    }
  }, []);

  useEffect(() => {
    console.log('POSScreen: Search query or gewerke filter changed');
    filterProducts();
  }, [searchQuery, products, selectedGewerke]);

  const fetchProjectDetails = async () => {
    console.log('POSScreen: Fetching project details for ID:', projectId);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      console.log('POSScreen: ✅ Project details fetched');
      setProject(data);
    } catch (error) {
      console.error('POSScreen: ❌ Error fetching project details', error);
    }
  };

  const fetchProducts = async () => {
    console.log('POSScreen: Fetching products from Supabase products table');
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('archived', false)
        .order('name', { ascending: true });

      if (error) {
        console.error('POSScreen: ❌ Error fetching products:', error);
        throw error;
      }

      console.log('POSScreen: ✅ Products fetched successfully');
      console.log('POSScreen: Total products:', data?.length || 0);
      setProducts(data || []);
      setFilteredProducts(data || []);
      
      // Extract unique gewerke/trades
      const trades = [...new Set(data?.map(p => p.trade).filter(Boolean) as string[])];
      console.log('POSScreen: Available Gewerke:', trades);
      setAvailableGewerke(trades);
    } catch (error) {
      console.error('POSScreen: ❌ Error in fetchProducts:', error);
      Alert.alert('Error', 'Failed to load products. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCartFromStorage = async () => {
    console.log('POSScreen: Loading cart from storage');
    try {
      const cartData = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (cartData) {
        const parsedCart = JSON.parse(cartData);
        console.log('POSScreen: ✅ Cart loaded, items:', parsedCart.length);
        setCart(parsedCart);
      } else {
        console.log('POSScreen: No cart data found (cart is empty)');
      }
    } catch (error) {
      console.error('POSScreen: ❌ Error loading cart:', error);
    }
  };

  const saveCartToStorage = async (updatedCart: CartItem[]) => {
    console.log('POSScreen: Saving cart to storage, items:', updatedCart.length);
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updatedCart));
      console.log('POSScreen: ✅ Cart saved successfully');
    } catch (error) {
      console.error('POSScreen: ❌ Error saving cart:', error);
    }
  };

  const filterProducts = () => {
    let filtered = products;
    
    // Filter by gewerke
    if (selectedGewerke) {
      filtered = filtered.filter(p => p.trade === selectedGewerke);
      console.log('POSScreen: Filtered by gewerke:', selectedGewerke, 'Count:', filtered.length);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.trade?.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query)
      );
      console.log('POSScreen: Filtered by search:', searchQuery, 'Count:', filtered.length);
    }

    setFilteredProducts(filtered);
  };

  const onRefresh = useCallback(() => {
    console.log('POSScreen: User triggered refresh');
    setRefreshing(true);
    fetchProducts();
  }, []);

  const openQuantityModal = (product: Product) => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔢 QUANTITY MODAL - Opening for product:', product.name);
    console.log('POSScreen: Zulage required:', product.zulage_required);
    console.log('POSScreen: Stock quantity:', product.quantity);
    console.log('═══════════════════════════════════════════════════════');
    
    setQuantityModalProduct(product);
    setSelectedQuantity(1);
    setQuantityInputText('1');
    setSelectedLocation('');
    setLocationAssignments([]);
    setShowQuantityModal(true);
  };

  const handleQuantityInputChange = (text: string) => {
    // Allow only numbers
    const numericText = text.replace(/[^0-9]/g, '');
    setQuantityInputText(numericText);
    
    // Update selected quantity if valid
    const quantity = parseInt(numericText, 10);
    if (!isNaN(quantity) && quantity > 0) {
      setSelectedQuantity(quantity);
    } else if (numericText === '') {
      setSelectedQuantity(0);
    }
  };

  const addLocationAssignment = () => {
    if (!selectedLocation) {
      Alert.alert('Location Required', 'Please select a location');
      return;
    }

    console.log('POSScreen: Adding location assignment:', selectedLocation);
    
    setLocationAssignments([...locationAssignments, { quantity: 1, location: selectedLocation }]);
    setSelectedLocation('');
  };

  const removeLocationAssignment = (index: number) => {
    console.log('POSScreen: Removing location assignment at index:', index);
    const updated = locationAssignments.filter((_, i) => i !== index);
    setLocationAssignments(updated);
  };

  const getTotalAssignedQuantity = () => {
    return locationAssignments.reduce((sum, assignment) => sum + assignment.quantity, 0);
  };

  const getLocationLabel = (locationValue: string) => {
    const room = ROOM_OPTIONS.find(r => r.value === locationValue);
    return room ? room.label : locationValue;
  };

  // Check if Add to Cart button should be disabled
  const isAddToCartDisabled = () => {
    if (!quantityModalProduct) return true;
    
    // Check if product is out of stock
    if (quantityModalProduct.quantity === null || quantityModalProduct.quantity === 0) {
      console.log('POSScreen: Add to Cart disabled - Product is out of stock');
      return true;
    }
    
    // Check if quantity is valid
    if (selectedQuantity <= 0) {
      console.log('POSScreen: Add to Cart disabled - Invalid quantity');
      return true;
    }

    // Check if product requires Zulage location tracking
    if (quantityModalProduct.zulage_required) {
      console.log('POSScreen: Product requires Zulage - checking location assignments');
      
      if (selectedQuantity === 1) {
        // Single location required
        if (!selectedLocation) {
          console.log('POSScreen: Add to Cart disabled - Single location not provided');
          return true;
        }
      } else {
        // Multiple locations required - all items must be assigned
        const totalAssigned = getTotalAssignedQuantity();
        if (totalAssigned !== selectedQuantity) {
          console.log('POSScreen: Add to Cart disabled - Not all locations assigned', {
            required: selectedQuantity,
            assigned: totalAssigned,
          });
          return true;
        }
      }
    }
    
    console.log('POSScreen: Add to Cart enabled - All conditions met');
    return false;
  };

  const confirmAddToCart = () => {
    if (!quantityModalProduct) return;
    
    if (selectedQuantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a quantity greater than 0');
      return;
    }

    // Check if product is out of stock
    if (quantityModalProduct.quantity === null || quantityModalProduct.quantity === 0) {
      Alert.alert('Out of Stock', 'This product is currently out of stock');
      return;
    }

    // Check if product requires Zulage location tracking
    if (quantityModalProduct.zulage_required) {
      console.log('POSScreen: Product requires Zulage location tracking');
      
      if (selectedQuantity === 1) {
        // Single location
        if (!selectedLocation) {
          Alert.alert('Location Required', 'Please select an installation location for this product');
          return;
        }
      } else {
        // Multiple locations
        const totalAssigned = getTotalAssignedQuantity();
        if (totalAssigned !== selectedQuantity) {
          Alert.alert(
            'Location Assignment Required',
            `Please assign all ${selectedQuantity} items to locations. Currently assigned: ${totalAssigned}`
          );
          return;
        }
      }
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('➕ ADD TO CART - Confirming with quantity:', selectedQuantity);
    console.log('POSScreen: Product:', quantityModalProduct.name);
    console.log('POSScreen: Zulage required:', quantityModalProduct.zulage_required);
    if (quantityModalProduct.zulage_required) {
      if (selectedQuantity === 1) {
        console.log('POSScreen: Single location:', selectedLocation);
      } else {
        console.log('POSScreen: Multiple locations:', locationAssignments);
      }
    }
    console.log('═══════════════════════════════════════════════════════');

    const existingItemIndex = cart.findIndex((item) => item.id === quantityModalProduct.id);

    let updatedCart: CartItem[];

    if (existingItemIndex !== -1) {
      // Item already in cart, increase quantity
      console.log('POSScreen: Product already in cart, increasing quantity');
      updatedCart = [...cart];
      updatedCart[existingItemIndex].cartQuantity += selectedQuantity;
      
      // Update location data if Zulage required
      if (quantityModalProduct.zulage_required) {
        if (selectedQuantity === 1 && selectedLocation) {
          // If adding single item with location, append to locationNotes
          const existingNotes = updatedCart[existingItemIndex].locationNotes || [];
          updatedCart[existingItemIndex].locationNotes = [
            ...existingNotes,
            { quantity: 1, location: selectedLocation }
          ];
        } else if (locationAssignments.length > 0) {
          // If adding multiple items with locations, append all assignments
          const existingNotes = updatedCart[existingItemIndex].locationNotes || [];
          updatedCart[existingItemIndex].locationNotes = [
            ...existingNotes,
            ...locationAssignments
          ];
        }
      }
    } else {
      // New item, add to cart
      console.log('POSScreen: Adding new product to cart');
      const newCartItem: CartItem = {
        id: quantityModalProduct.id,
        name: quantityModalProduct.name,
        sale_price: quantityModalProduct.sale_price,
        cartQuantity: selectedQuantity,
        product_id: quantityModalProduct.id,
        source: 'supabase',
        unit: quantityModalProduct.unit,
        photo: quantityModalProduct.photo,
      };

      // Add location data if Zulage required
      if (quantityModalProduct.zulage_required) {
        if (selectedQuantity === 1 && selectedLocation) {
          newCartItem.locationNote = selectedLocation;
        } else if (locationAssignments.length > 0) {
          newCartItem.locationNotes = locationAssignments;
        }
      }

      updatedCart = [...cart, newCartItem];
    }

    console.log('POSScreen: Updated cart items:', updatedCart.length);
    setCart(updatedCart);
    saveCartToStorage(updatedCart);
    
    // Close modal and reset state
    setShowQuantityModal(false);
    setQuantityModalProduct(null);
    setSelectedQuantity(1);
    setQuantityInputText('1');
    setSelectedLocation('');
    setLocationAssignments([]);
  };

  const getCartItemQuantity = (productId: string) => {
    const item = cart.find((item) => item.id === productId);
    return item ? item.cartQuantity : 0;
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.sale_price * item.cartQuantity, 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((sum, item) => sum + item.cartQuantity, 0);
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

  const handleCheckout = () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('💳 CHECKOUT BUTTON CLICKED');
    console.log('POSScreen: Cart items:', cart.length);
    console.log('POSScreen: Total amount:', getCartTotal());
    console.log('POSScreen: Delivery mode:', deliveryMode);
    console.log('POSScreen: Project address:', getFullAddress());
    console.log('═══════════════════════════════════════════════════════');

    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart before checking out');
      return;
    }

    console.log('POSScreen: Navigating to checkout with params');
    router.push({
      pathname: '/checkout',
      params: {
        projectId,
        projectExternalId: project?.external_id || projectExternalId,
        employeeId,
        employeeName,
        deliveryMode,
      },
    });
  };

  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };
  
  const getStockStatus = (quantity: number | null) => {
    if (quantity === null || quantity === 0) {
      return { text: 'Out of Stock', color: '#EF4444' };
    } else if (quantity < 10) {
      return { text: `Low Stock (${quantity})`, color: '#F59E0B' };
    } else {
      return { text: `In Stock (${quantity})`, color: '#10B981' };
    }
  };

  // QR Scanner Functions
  const [permission, requestPermission] = useCameraPermissions();

  const openQRScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Camera permission is required');
        return;
      }
    }
    setShowQRScanner(true);
    setScanned(false);
  };
  

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    console.log('═══════════════════════════════════════════════════════');
    console.log('📷 QR CODE SCANNED');
    console.log('POSScreen: QR Code data:', data);
    console.log('POSScreen: Barcode type:', type);
    console.log('═══════════════════════════════════════════════════════');

    // Search for product with matching QR code
    const matchedProduct = products.find(
      (product) => product.qr_code && product.qr_code === data
    );

    if (matchedProduct) {
      console.log('POSScreen: ✅ Product found:', matchedProduct.name);
      
      // Close scanner
      setShowQRScanner(false);
      
      // Open quantity modal for the matched product
      setTimeout(() => {
        openQuantityModal(matchedProduct);
      }, 300);
    } else {
      console.log('POSScreen: ❌ No product found with QR code:', data);
      Alert.alert(
        'Product Not Found',
        'No product matches this QR code. Please try again or add the product manually.',
        [
          {
            text: 'Scan Again',
            onPress: () => setScanned(false),
          },
          {
            text: 'Close',
            onPress: () => setShowQRScanner(false),
            style: 'cancel',
          },
        ]
      );
    }
  };

  const renderProductCard = ({ item: product, index }: { item: Product; index: number }) => {
    const cartQuantity = getCartItemQuantity(product.id);
    const stockStatus = getStockStatus(product.quantity);
    const isInCart = cartQuantity > 0;
    const isOutOfStock = product.quantity === null || product.quantity === 0;
    
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 30).springify()}
        style={styles.productCardWrapper}
      >
        <View 
          style={[
            styles.productCard, 
            { backgroundColor: themeColors.card },
            shadows.medium,
            isInCart && styles.productCardInCart,
            isInCart && { borderColor: themeColors.primary, borderWidth: 2 }
          ]}
        >
          {product.photo ? (
            <Image
              source={{ uri: product.photo }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.productImagePlaceholder,
                { backgroundColor: themeColors.border },
              ]}
            >
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={32}
                color={themeColors.textSecondary}
              />
            </View>
          )}

          {/* In Cart Badge */}
          {isInCart && (
            <View style={[styles.inCartBadge, { backgroundColor: themeColors.primary }]}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.inCartBadgeText}>In Cart</Text>
            </View>
          )}

          {/* Zulage Required Badge */}
          {product.zulage_required && (
            <View style={[styles.zulageBadge, { backgroundColor: '#F59E0B' }]}>
              <IconSymbol
                ios_icon_name="location.fill"
                android_material_icon_name="location-on"
                size={12}
                color="#FFFFFF"
              />
              <Text style={styles.zulageBadgeText}>Location Required</Text>
            </View>
          )}

          <View style={styles.productInfo}>
            <Text style={[styles.productName, { color: themeColors.text }]} numberOfLines={2}>
              {product.name}
            </Text>

            {product.trade && (
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: themeColors.primary + '20' },
                ]}
              >
                <Text style={[styles.categoryText, { color: themeColors.primary }]}>
                  {product.trade}
                </Text>
              </View>
            )}
            
            {/* Stock Status */}
            <View style={[styles.stockBadge, { backgroundColor: stockStatus.color + '20' }]}>
              <View style={[styles.stockDot, { backgroundColor: stockStatus.color }]} />
              <Text style={[styles.stockText, { color: stockStatus.color }]}>
                {stockStatus.text}
              </Text>
            </View>

            {/* Description Preview - Clickable */}
            {product.description && (
              <TouchableOpacity
                onPress={() => {
                  console.log('POSScreen: User tapped product description');
                  setSelectedProduct(product);
                  setShowProductModal(true);
                }}
                style={styles.descriptionPreview}
              >
                <Text
                  style={[styles.descriptionText, { color: themeColors.primary }]}
                  numberOfLines={1}
                >
                  View Details →
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.productFooter}>
              <View style={styles.priceContainer}>
                <Text style={[styles.productPrice, { color: themeColors.primary }]}>
                  {formatPrice(product.sale_price)}
                </Text>
                {product.unit && (
                  <Text style={[styles.productUnit, { color: themeColors.textSecondary }]}>
                    per {product.unit}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.addButton,
                  { backgroundColor: isOutOfStock ? '#9CA3AF' : themeColors.primary },
                ]}
                onPress={() => openQuantityModal(product)}
                disabled={isOutOfStock}
              >
                <IconSymbol
                  ios_icon_name="plus"
                  android_material_icon_name="add"
                  size={18}
                  color="#FFFFFF"
                />
                {cartQuantity > 0 && (
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityBadgeText}>{cartQuantity}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  console.log('POSScreen: Rendering UI with products:', filteredProducts.length);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'POS - Add Products',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: themeColors.background,
          },
          headerTintColor: themeColors.text,
        }}
      />

      {/* Compact Header with project info */}
      <Animated.View entering={FadeInUp.springify()}>
        <LinearGradient
          colors={[themeColors.primary, themeColors.primary + 'DD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerInfo}>
              <View style={styles.headerIconBadge}>
                <IconSymbol
                  ios_icon_name="building.2"
                  android_material_icon_name="business"
                  size={16}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerLabel}>Project</Text>
                <Text style={styles.headerValue} numberOfLines={1}>
                  {project?.external_id || projectExternalId || 'N/A'}
                </Text>
              </View>
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.headerIconBadge}>
                <IconSymbol
                  ios_icon_name="person.circle"
                  android_material_icon_name="person"
                  size={16}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerLabel}>Employee</Text>
                <Text style={styles.headerValue} numberOfLines={1}>
                  {employeeName || 'N/A'}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Project Address - Only address, zip code, and city */}
          {project && (
            <View style={styles.projectAddressContainer}>
              <IconSymbol
                ios_icon_name="location.fill"
                android_material_icon_name="location-on"
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.projectAddressText} numberOfLines={2}>
                {getFullAddress()}
              </Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Delivery Mode Selection */}
      <View style={styles.deliveryModeSection}>
        <TouchableOpacity
          style={styles.deliveryModeButton}
          onPress={() => setShowDeliveryModal(true)}
        >
          <LinearGradient
            colors={deliveryMode === 'pickup' ? ['#10B981', '#059669'] : ['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.deliveryModeGradient}
          >
            <IconSymbol
              ios_icon_name={deliveryMode === 'pickup' ? 'bag.fill' : 'shippingbox.fill'}
              android_material_icon_name={deliveryMode === 'pickup' ? 'shopping-bag' : 'local-shipping'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.deliveryModeText}>
              {deliveryMode === 'pickup' ? 'Pick Up' : 'Delivery'}
            </Text>
            <IconSymbol
              ios_icon_name="chevron.down"
              android_material_icon_name="arrow-drop-down"
              size={20}
              color="#FFFFFF"
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: themeColors.card }]}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={themeColors.textSecondary}
          />
          <TextInput
            style={[styles.searchInput, { color: themeColors.text }]}
            placeholder="Search products..."
            placeholderTextColor={themeColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
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
      </View>
      
      {/* Gewerke Filter */}
      {availableGewerke.length > 0 && (
        <View style={styles.gewerkeFilterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gewerkeScroll}
          >
            <TouchableOpacity
              style={[
                styles.gewerkeChip,
                { backgroundColor: !selectedGewerke ? themeColors.primary : themeColors.card },
                shadows.small,
              ]}
              onPress={() => {
                console.log('POSScreen: User selected All gewerke');
                setSelectedGewerke(null);
              }}
            >
              <Text
                style={[
                  styles.gewerkeChipText,
                  { color: !selectedGewerke ? '#FFFFFF' : themeColors.text },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            
            {availableGewerke.map((gewerke) => (
              <TouchableOpacity
                key={gewerke}
                style={[
                  styles.gewerkeChip,
                  { backgroundColor: selectedGewerke === gewerke ? themeColors.primary : themeColors.card },
                  shadows.small,
                ]}
                onPress={() => {
                  console.log('POSScreen: User selected gewerke:', gewerke);
                  setSelectedGewerke(gewerke);
                }}
              >
                <Text
                  style={[
                    styles.gewerkeChipText,
                    { color: selectedGewerke === gewerke ? '#FFFFFF' : themeColors.text },
                  ]}
                >
                  {gewerke}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Products List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading products...
          </Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={[themeColors.primary + '20', themeColors.primary + '10']}
            style={styles.emptyIconContainer}
          >
            <IconSymbol
              ios_icon_name="cube.box"
              android_material_icon_name="inventory"
              size={64}
              color={themeColors.primary}
            />
          </LinearGradient>
          <Text style={[styles.emptyText, { color: themeColors.text }]}>
            {searchQuery || selectedGewerke ? 'No products found' : 'No products available'}
          </Text>
          <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
            {searchQuery || selectedGewerke
              ? 'Try a different search or filter'
              : 'Products will appear here once added to the database'}
          </Text>
        </View>
      ) : (
        <View style={styles.productsContainer}>
          <Text style={[styles.resultsText, { color: themeColors.textSecondary }]}>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}{' '}
            {searchQuery || selectedGewerke ? 'found' : 'available'}
          </Text>

          <FlatList
            data={filteredProducts}
            renderItem={renderProductCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.productRow}
            contentContainerStyle={styles.productListContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={themeColors.primary}
              />
            }
          />
        </View>
      )}

      {/* Floating QR Scanner Button */}
      <Animated.View entering={FadeInUp.springify()} style={styles.floatingQRContainer}>
        <TouchableOpacity
          style={[styles.floatingQRButton, { backgroundColor: '#8B5CF6' }, shadows.large]}
          onPress={openQRScanner}
        >
          <IconSymbol
            ios_icon_name="qrcode.viewfinder"
            android_material_icon_name="qr-code-scanner"
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Floating Cart Button - Round and Smaller */}
      {cart.length > 0 && (
        <Animated.View entering={FadeInUp.springify()} style={styles.floatingCartContainer}>
          <TouchableOpacity
            style={[styles.floatingCartButton, { backgroundColor: themeColors.primary }, shadows.large]}
            onPress={handleCheckout}
          >
            <View style={styles.cartIconContainer}>
              <IconSymbol
                ios_icon_name="cart.fill"
                android_material_icon_name="shopping-cart"
                size={28}
                color="#FFFFFF"
              />
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{getCartItemCount()}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* QR Scanner Modal */}
      <Modal
        visible={showQRScanner}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowQRScanner(false)}
      >
        <View style={styles.qrScannerContainer}>
        {!permission ? (
  <View style={styles.qrPermissionContainer}>
    <ActivityIndicator size="large" color={themeColors.primary} />
    <Text style={[styles.qrPermissionText, { color: themeColors.text }]}>
      Requesting camera permission...
    </Text>
  </View>
) : !permission.granted ? (
  <View style={styles.qrPermissionContainer}>
    <IconSymbol
      ios_icon_name="camera.fill"
      android_material_icon_name="camera"
      size={64}
      color="#EF4444"
    />
    <Text style={[styles.qrPermissionText, { color: themeColors.text }]}>
      Camera permission denied
    </Text>
    <TouchableOpacity
      style={[styles.qrCloseButton, { backgroundColor: themeColors.primary }]}
      onPress={() => setShowQRScanner(false)}
    >
      <Text style={styles.qrCloseButtonText}>Close</Text>
    </TouchableOpacity>
  </View>
) : (
  <>
    <CameraView
      style={StyleSheet.absoluteFillObject}
      facing="back"
      barcodeScannerSettings={{
        barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'],
      }}
      onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
    /> 
)}
         {/* Scanner Overlay */}
              <View style={styles.qrOverlay}>
                <View style={styles.qrHeader}>
                  <Text style={styles.qrHeaderTitle}>Scan Product QR Code</Text>
                  <TouchableOpacity
                    style={styles.qrCloseIconButton}
                    onPress={() => setShowQRScanner(false)}
                  >
                    <IconSymbol
                      ios_icon_name="xmark.circle.fill"
                      android_material_icon_name="cancel"
                      size={32}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
                
                {/* Scanning Frame */}
                <View style={styles.qrScanningArea}>
                  <View style={styles.qrFrame}>
                    <View style={[styles.qrCorner, styles.qrCornerTopLeft]} />
                    <View style={[styles.qrCorner, styles.qrCornerTopRight]} />
                    <View style={[styles.qrCorner, styles.qrCornerBottomLeft]} />
                    <View style={[styles.qrCorner, styles.qrCornerBottomRight]} />
                  </View>
                  <Text style={styles.qrInstructionText}>
                    Position the QR code within the frame
                  </Text>
                </View>
                
                {scanned && (
                  <View style={styles.qrScannedContainer}>
                    <TouchableOpacity
                      style={[styles.qrScanAgainButton, { backgroundColor: themeColors.primary }]}
                      onPress={() => setScanned(false)}
                    >
                      <IconSymbol
                        ios_icon_name="arrow.clockwise"
                        android_material_icon_name="refresh"
                        size={24}
                        color="#FFFFFF"
                      />
                      <Text style={styles.qrScanAgainButtonText}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Quantity Selector Modal with Dropdown Location Selection */}
      <Modal
        visible={showQuantityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQuantityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.quantityModalContent, { backgroundColor: themeColors.card }]}>
            <View style={styles.quantityModalHeader}>
              <Text style={[styles.quantityModalTitle, { color: themeColors.text }]}>
                Select Quantity
              </Text>
              <TouchableOpacity
                onPress={() => setShowQuantityModal(false)}
                style={styles.modalCloseButton}
              >
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={28}
                  color={themeColors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.quantityModalScroll} showsVerticalScrollIndicator={false}>
              {quantityModalProduct && (
                <View style={styles.quantityModalBody}>
                  {/* Product Info */}
                  <View style={styles.quantityProductInfo}>
                    {quantityModalProduct.photo ? (
                      <Image
                        source={{ uri: quantityModalProduct.photo }}
                        style={styles.quantityProductImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.quantityProductImagePlaceholder,
                          { backgroundColor: themeColors.border },
                        ]}
                      >
                        <IconSymbol
                          ios_icon_name="photo"
                          android_material_icon_name="image"
                          size={32}
                          color={themeColors.textSecondary}
                        />
                      </View>
                    )}
                    <View style={styles.quantityProductDetails}>
                      <Text style={[styles.quantityProductName, { color: themeColors.text }]}>
                        {quantityModalProduct.name}
                      </Text>
                      <Text style={[styles.quantityProductPrice, { color: themeColors.primary }]}>
                        {formatPrice(quantityModalProduct.sale_price)}
                        {quantityModalProduct.unit && ` / ${quantityModalProduct.unit}`}
                      </Text>
                      {quantityModalProduct.zulage_required && (
                        <View style={[styles.zulageRequiredBadge, { backgroundColor: '#F59E0B' + '20' }]}>
                          <IconSymbol
                            ios_icon_name="location.fill"
                            android_material_icon_name="location-on"
                            size={14}
                            color="#F59E0B"
                          />
                          <Text style={[styles.zulageRequiredText, { color: '#F59E0B' }]}>
                            Installation location required
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Quantity Selector with Plus/Minus Buttons AND Input */}
                  <View style={styles.quantitySelectorContainer}>
                    <TouchableOpacity
                      style={[
                        styles.quantityButton,
                        { backgroundColor: themeColors.background },
                        selectedQuantity <= 1 && styles.quantityButtonDisabled,
                      ]}
                      onPress={() => {
                        if (selectedQuantity > 1) {
                          const newQuantity = selectedQuantity - 1;
                          console.log('POSScreen: Decreasing quantity to', newQuantity);
                          setSelectedQuantity(newQuantity);
                          setQuantityInputText(newQuantity.toString());
                        }
                      }}
                      disabled={selectedQuantity <= 1}
                    >
                      <IconSymbol
                        ios_icon_name="minus"
                        android_material_icon_name="remove"
                        size={24}
                        color={selectedQuantity <= 1 ? themeColors.textSecondary : themeColors.text}
                      />
                    </TouchableOpacity>

                    {/* Input Field for Quantity */}
                    <View style={[styles.quantityInputContainer, { backgroundColor: themeColors.background }]}>
                      <TextInput
                        style={[styles.quantityInput, { color: themeColors.text }]}
                        value={quantityInputText}
                        onChangeText={handleQuantityInputChange}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        maxLength={5}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.quantityButton, { backgroundColor: themeColors.background }]}
                      onPress={() => {
                        const newQuantity = selectedQuantity + 1;
                        console.log('POSScreen: Increasing quantity to', newQuantity);
                        setSelectedQuantity(newQuantity);
                        setQuantityInputText(newQuantity.toString());
                      }}
                    >
                      <IconSymbol
                        ios_icon_name="plus"
                        android_material_icon_name="add"
                        size={24}
                        color={themeColors.text}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Quick Quantity Buttons */}
                  <View style={styles.quickQuantityContainer}>
                    {[1, 5, 10, 20].map((qty) => (
                      <TouchableOpacity
                        key={qty}
                        style={[
                          styles.quickQuantityButton,
                          { backgroundColor: themeColors.background },
                          selectedQuantity === qty && {
                            backgroundColor: themeColors.primary,
                          },
                        ]}
                        onPress={() => {
                          console.log('POSScreen: Quick select quantity:', qty);
                          setSelectedQuantity(qty);
                          setQuantityInputText(qty.toString());
                        }}
                      >
                        <Text
                          style={[
                            styles.quickQuantityText,
                            { color: themeColors.text },
                            selectedQuantity === qty && { color: '#FFFFFF' },
                          ]}
                        >
                          {qty}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Zulage Location Selection - Dropdown Style */}
                  {quantityModalProduct.zulage_required && (
                    <View style={[styles.zulageSection, { backgroundColor: themeColors.background }]}>
                      <View style={styles.zulageSectionHeader}>
                        <IconSymbol
                          ios_icon_name="location.fill"
                          android_material_icon_name="location-on"
                          size={20}
                          color="#F59E0B"
                        />
                        <Text style={[styles.zulageSectionTitle, { color: themeColors.text }]}>
                          Installation Location
                        </Text>
                      </View>

                      {selectedQuantity === 1 ? (
                        // Single location - Dropdown Select
                        <View style={styles.singleLocationContainer}>
                          <Text style={[styles.locationLabel, { color: themeColors.textSecondary }]}>
                            Select installation location:
                          </Text>
                          
                          {/* Dropdown Button */}
                          <TouchableOpacity
                            style={[
                              styles.dropdownButton,
                              { backgroundColor: themeColors.card, borderColor: themeColors.border },
                              selectedLocation && { borderColor: '#F59E0B' }
                            ]}
                            onPress={() => setShowLocationDropdown(!showLocationDropdown)}
                          >
                            <View style={styles.dropdownButtonContent}>
                              <IconSymbol
                                ios_icon_name="location.fill"
                                android_material_icon_name="location-on"
                                size={18}
                                color={selectedLocation ? '#F59E0B' : themeColors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.dropdownButtonText,
                                  { color: selectedLocation ? themeColors.text : themeColors.textSecondary }
                                ]}
                              >
                                {selectedLocation ? getLocationLabel(selectedLocation) : 'Select location...'}
                              </Text>
                            </View>
                            <IconSymbol
                              ios_icon_name={showLocationDropdown ? "chevron.up" : "chevron.down"}
                              android_material_icon_name={showLocationDropdown ? "arrow-drop-up" : "arrow-drop-down"}
                              size={24}
                              color={themeColors.textSecondary}
                            />
                          </TouchableOpacity>

                          {/* Dropdown Options */}
                          {showLocationDropdown && (
                            <View style={[styles.dropdownOptions, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                              <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                                {ROOM_OPTIONS.map((room) => (
                                  <TouchableOpacity
                                    key={room.value}
                                    style={[
                                      styles.dropdownOption,
                                      selectedLocation === room.value && { backgroundColor: '#F59E0B' + '15' }
                                    ]}
                                    onPress={() => {
                                      console.log('POSScreen: Selected location:', room.value);
                                      setSelectedLocation(room.value);
                                      setShowLocationDropdown(false);
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.dropdownOptionText,
                                        { color: themeColors.text },
                                        selectedLocation === room.value && { color: '#F59E0B', fontWeight: '700' }
                                      ]}
                                    >
                                      {room.label}
                                    </Text>
                                    {selectedLocation === room.value && (
                                      <IconSymbol
                                        ios_icon_name="checkmark"
                                        android_material_icon_name="check"
                                        size={20}
                                        color="#F59E0B"
                                      />
                                    )}
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      ) : (
                        // Multiple location assignments
                        <View style={styles.multipleLocationContainer}>
                          <Text style={[styles.locationLabel, { color: themeColors.textSecondary }]}>
                            Assign each item to a location ({getTotalAssignedQuantity()}/{selectedQuantity} assigned):
                          </Text>

                          {/* Location Assignments List */}
                          {locationAssignments.length > 0 && (
                            <View style={styles.assignmentsList}>
                              {locationAssignments.map((assignment, index) => (
                                <View
                                  key={index}
                                  style={[styles.assignmentItem, { backgroundColor: themeColors.card }]}
                                >
                                  <View style={styles.assignmentInfo}>
                                    <IconSymbol
                                      ios_icon_name="location.fill"
                                      android_material_icon_name="location-on"
                                      size={16}
                                      color="#F59E0B"
                                    />
                                    <Text style={[styles.assignmentText, { color: themeColors.text }]}>
                                      {getLocationLabel(assignment.location)}
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => removeLocationAssignment(index)}
                                    style={styles.removeAssignmentButton}
                                  >
                                    <IconSymbol
                                      ios_icon_name="xmark.circle.fill"
                                      android_material_icon_name="cancel"
                                      size={20}
                                      color="#EF4444"
                                    />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Add Location Assignment - Dropdown */}
                          {getTotalAssignedQuantity() < selectedQuantity && (
                            <View style={styles.addLocationContainer}>
                              {/* Dropdown Button */}
                              <TouchableOpacity
                                style={[
                                  styles.dropdownButton,
                                  { backgroundColor: themeColors.card, borderColor: themeColors.border },
                                  selectedLocation && { borderColor: '#F59E0B' }
                                ]}
                                onPress={() => setShowLocationDropdown(!showLocationDropdown)}
                              >
                                <View style={styles.dropdownButtonContent}>
                                  <IconSymbol
                                    ios_icon_name="location.fill"
                                    android_material_icon_name="location-on"
                                    size={18}
                                    color={selectedLocation ? '#F59E0B' : themeColors.textSecondary}
                                  />
                                  <Text
                                    style={[
                                      styles.dropdownButtonText,
                                      { color: selectedLocation ? themeColors.text : themeColors.textSecondary }
                                    ]}
                                  >
                                    {selectedLocation ? getLocationLabel(selectedLocation) : 'Select location...'}
                                  </Text>
                                </View>
                                <IconSymbol
                                  ios_icon_name={showLocationDropdown ? "chevron.up" : "chevron.down"}
                                  android_material_icon_name={showLocationDropdown ? "arrow-drop-up" : "arrow-drop-down"}
                                  size={24}
                                  color={themeColors.textSecondary}
                                />
                              </TouchableOpacity>

                              {/* Dropdown Options */}
                              {showLocationDropdown && (
                                <View style={[styles.dropdownOptions, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                                  <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                                    {ROOM_OPTIONS.map((room) => (
                                      <TouchableOpacity
                                        key={room.value}
                                        style={[
                                          styles.dropdownOption,
                                          selectedLocation === room.value && { backgroundColor: '#F59E0B' + '15' }
                                        ]}
                                        onPress={() => {
                                          console.log('POSScreen: Selected location for assignment:', room.value);
                                          setSelectedLocation(room.value);
                                          setShowLocationDropdown(false);
                                        }}
                                      >
                                        <Text
                                          style={[
                                            styles.dropdownOptionText,
                                            { color: themeColors.text },
                                            selectedLocation === room.value && { color: '#F59E0B', fontWeight: '700' }
                                          ]}
                                        >
                                          {room.label}
                                        </Text>
                                        {selectedLocation === room.value && (
                                          <IconSymbol
                                            ios_icon_name="checkmark"
                                            android_material_icon_name="check"
                                            size={20}
                                            color="#F59E0B"
                                          />
                                        )}
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>
                              )}

                              <TouchableOpacity
                                style={[
                                  styles.addLocationButton,
                                  { backgroundColor: '#F59E0B' },
                                  !selectedLocation && styles.addLocationButtonDisabled,
                                ]}
                                onPress={addLocationAssignment}
                                disabled={!selectedLocation}
                              >
                                <IconSymbol
                                  ios_icon_name="plus.circle.fill"
                                  android_material_icon_name="add-circle"
                                  size={20}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.addLocationButtonText}>
                                  Add Location
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Total Price */}
                  <View style={[styles.quantityTotalContainer, { backgroundColor: themeColors.background }]}>
                    <Text style={[styles.quantityTotalLabel, { color: themeColors.textSecondary }]}>
                      Total Price
                    </Text>
                    <Text style={[styles.quantityTotalValue, { color: themeColors.primary }]}>
                      {formatPrice(quantityModalProduct.sale_price * selectedQuantity)}
                    </Text>
                  </View>

                  {/* Add to Cart Button - Disabled based on conditions */}
                  <TouchableOpacity
                    style={[
                      styles.confirmQuantityButton,
                      { backgroundColor: isAddToCartDisabled() ? '#9CA3AF' : themeColors.primary },
                    ]}
                    onPress={confirmAddToCart}
                    disabled={isAddToCartDisabled()}
                  >
                    <IconSymbol
                      ios_icon_name="cart.fill.badge.plus"
                      android_material_icon_name="add-shopping-cart"
                      size={24}
                      color="#FFFFFF"
                    />
                    <Text style={styles.confirmQuantityButtonText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delivery Mode Selection Modal */}
      <Modal
        visible={showDeliveryModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeliveryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deliveryModalContent, { backgroundColor: themeColors.background }]}>
            <Text style={[styles.deliveryModalTitle, { color: themeColors.text }]}>
              Select Delivery Mode
            </Text>

            <TouchableOpacity
              style={[
                styles.deliveryOption,
                { backgroundColor: themeColors.card },
                deliveryMode === 'pickup' && { borderColor: '#10B981', borderWidth: 2 },
              ]}
              onPress={() => {
                console.log('POSScreen: User selected Pick Up mode');
                setDeliveryMode('pickup');
                setShowDeliveryModal(false);
              }}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.deliveryOptionIcon}
              >
                <IconSymbol
                  ios_icon_name="bag.fill"
                  android_material_icon_name="shopping-bag"
                  size={32}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <View style={styles.deliveryOptionText}>
                <Text style={[styles.deliveryOptionTitle, { color: themeColors.text }]}>
                  Pick Up
                </Text>
                <Text style={[styles.deliveryOptionDescription, { color: themeColors.textSecondary }]}>
                  Customer will pick up the order
                </Text>
              </View>
              {deliveryMode === 'pickup' && (
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color="#10B981"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deliveryOption,
                { backgroundColor: themeColors.card },
                deliveryMode === 'delivery' && { borderColor: '#6366F1', borderWidth: 2 },
              ]}
              onPress={() => {
                console.log('POSScreen: User selected Delivery mode');
                setDeliveryMode('delivery');
                setShowDeliveryModal(false);
              }}
            >
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                style={styles.deliveryOptionIcon}
              >
                <IconSymbol
                  ios_icon_name="shippingbox.fill"
                  android_material_icon_name="local-shipping"
                  size={32}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <View style={styles.deliveryOptionText}>
                <Text style={[styles.deliveryOptionTitle, { color: themeColors.text }]}>
                  Delivery
                </Text>
                <Text style={[styles.deliveryOptionDescription, { color: themeColors.textSecondary }]}>
                  Order will be delivered to customer
                </Text>
              </View>
              {deliveryMode === 'delivery' && (
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color="#6366F1"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeModalButton, { backgroundColor: themeColors.card }]}
              onPress={() => setShowDeliveryModal(false)}
            >
              <Text style={[styles.closeModalButtonText, { color: themeColors.text }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Product Description Modal */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.productModalContent, { backgroundColor: themeColors.card }]}>
            <View style={styles.productModalHeader}>
              <Text style={[styles.productModalTitle, { color: themeColors.text }]}>
                Product Details
              </Text>
              <TouchableOpacity
                onPress={() => setShowProductModal(false)}
                style={styles.modalCloseButton}
              >
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={28}
                  color={themeColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            
            {selectedProduct && (
              <ScrollView style={styles.productModalScroll} showsVerticalScrollIndicator={false}>
                {selectedProduct.photo && (
                  <Image
                    source={{ uri: selectedProduct.photo }}
                    style={styles.productModalImage}
                    resizeMode="cover"
                  />
                )}
                
                <Text style={[styles.productModalName, { color: themeColors.text }]}>
                  {selectedProduct.name}
                </Text>
                
                {selectedProduct.trade && (
                  <View style={[styles.productModalBadge, { backgroundColor: themeColors.primary + '20' }]}>
                    <Text style={[styles.productModalBadgeText, { color: themeColors.primary }]}>
                      {selectedProduct.trade}
                    </Text>
                  </View>
                )}
                
                <View style={styles.productModalPriceRow}>
                  <Text style={[styles.productModalPrice, { color: themeColors.primary }]}>
                    {formatPrice(selectedProduct.sale_price)}
                  </Text>
                  {selectedProduct.unit && (
                    <Text style={[styles.productModalUnit, { color: themeColors.textSecondary }]}>
                      per {selectedProduct.unit}
                    </Text>
                  )}
                </View>
                
                {selectedProduct.description && (
                  <View style={styles.productModalDescriptionSection}>
                    <Text style={[styles.productModalSectionTitle, { color: themeColors.text }]}>
                      Description
                    </Text>
                    <Text style={[styles.productModalDescription, { color: themeColors.textSecondary }]}>
                      {selectedProduct.description}
                    </Text>
                  </View>
                )}
                
                <TouchableOpacity
                  style={[styles.productModalAddButton, { backgroundColor: themeColors.primary }]}
                  onPress={() => {
                    setShowProductModal(false);
                    openQuantityModal(selectedProduct);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="cart.fill.badge.plus"
                    android_material_icon_name="add-shopping-cart"
                    size={24}
                    color="#FFFFFF"
                  />
                  <Text style={styles.productModalAddButtonText}>Add to Cart</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  },
  headerContent: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 2,
  },
  headerValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  projectAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  projectAddressText: {
    flex: 1,
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  deliveryModeSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  deliveryModeButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.medium,
  },
  deliveryModeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  deliveryModeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.small,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  gewerkeFilterSection: {
    paddingVertical: spacing.sm,
  },
  gewerkeScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  gewerkeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  gewerkeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
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
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
  },
  productsContainer: {
    flex: 1,
  },
  resultsText: {
    fontSize: 13,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  productListContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 200,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  productCardWrapper: {
    width: '48%',
  },
  productCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  productCardInCart: {
    // Highlighted style for products in cart
  },
  inCartBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    zIndex: 10,
  },
  inCartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  zulageBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    zIndex: 10,
  },
  zulageBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  productImage: {
    width: '100%',
    height: 120,
  },
  productImagePlaceholder: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: spacing.sm,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xs,
    minHeight: 36,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    gap: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: 10,
    fontWeight: '600',
  },
  descriptionPreview: {
    marginBottom: spacing.xs,
  },
  descriptionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  priceContainer: {
    flex: 1,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  productUnit: {
    fontSize: 10,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...shadows.small,
  },
  quantityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  quantityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  floatingQRContainer: {
    position: 'absolute',
    bottom: 180,
    right: spacing.lg,
  },
  floatingQRButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingCartContainer: {
    position: 'absolute',
    bottom: 100,
    right: spacing.lg,
  },
  floatingCartButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartIconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartCountBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  cartCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  qrScannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  qrPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  qrPermissionText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  qrCloseButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
  },
  qrCloseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qrOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 48 : 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  qrHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qrCloseIconButton: {
    padding: spacing.xs,
  },
  qrScanningArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  qrCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
  },
  qrCornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  qrCornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  qrCornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  qrCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  qrInstructionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  qrScannedContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  qrScanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.large,
  },
  qrScanAgainButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  quantityModalContent: {
    width: '90%',
    maxHeight: '90%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.large,
  },
  quantityModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  quantityModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  quantityModalScroll: {
    maxHeight: '100%',
  },
  quantityModalBody: {
    padding: spacing.lg,
  },
  quantityProductInfo: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quantityProductImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },
  quantityProductImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityProductDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  quantityProductName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  quantityProductPrice: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  zulageRequiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  zulageRequiredText: {
    fontSize: 11,
    fontWeight: '600',
  },
  quantitySelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  quantityButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityInputContainer: {
    minWidth: 100,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  quantityInput: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: spacing.sm,
  },
  quickQuantityContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickQuantityButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.small,
  },
  quickQuantityText: {
    fontSize: 16,
    fontWeight: '700',
  },
  zulageSection: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  zulageSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  zulageSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  singleLocationContainer: {
    gap: spacing.sm,
  },
  locationLabel: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    ...shadows.small,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  dropdownButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownOptions: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    maxHeight: 200,
    ...shadows.medium,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  dropdownOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  multipleLocationContainer: {
    gap: spacing.sm,
  },
  assignmentsList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  assignmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  assignmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeAssignmentButton: {
    padding: spacing.xs,
  },
  addLocationContainer: {
    gap: spacing.sm,
  },
  addLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    ...shadows.medium,
  },
  addLocationButtonDisabled: {
    opacity: 0.5,
  },
  addLocationButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quantityTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  quantityTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  quantityTotalValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  confirmQuantityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  confirmQuantityButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deliveryModalContent: {
    width: '90%',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.large,
  },
  deliveryModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  deliveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadows.small,
  },
  deliveryOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryOptionText: {
    flex: 1,
  },
  deliveryOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  deliveryOptionDescription: {
    fontSize: 13,
  },
  closeModalButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  productModalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.large,
  },
  productModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  productModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  productModalScroll: {
    padding: spacing.lg,
  },
  productModalImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  productModalName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  productModalBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  productModalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  productModalPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  productModalPrice: {
    fontSize: 28,
    fontWeight: '800',
  },
  productModalUnit: {
    fontSize: 14,
  },
  productModalDescriptionSection: {
    marginBottom: spacing.lg,
  },
  productModalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  productModalDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  productModalAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  productModalAddButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
