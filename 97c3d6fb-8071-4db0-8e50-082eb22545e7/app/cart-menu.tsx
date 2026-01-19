
import { IconSymbol } from '@/components/IconSymbol';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { useTheme } from '@react-navigation/native';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

interface CartItem {
  id: string;
  name: string;
  sale_price: number;
  cartQuantity: number;
  product_id: string | null;
  source: string;
  unit: string | null;
  photo: string | null;
}

interface Project {
  id: string;
  external_id: string;
  address: string;
  zipcode: string;
  city: string;
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
const ORDER_STATE_KEY = '@order_state';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function MenuButton({ 
  title, 
  description, 
  icon, 
  gradientColors, 
  onPress, 
  delay,
  disabled = false,
}: {
  title: string;
  description: string;
  icon: string;
  gradientColors: string[];
  onPress: () => void;
  delay: number;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotateZ: `${rotate.value}deg` },
    ],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = () => {
    rotate.value = withSequence(
      withTiming(-2, { duration: 50 }),
      withTiming(2, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
    onPress();
  };

  return (
    <Animated.View 
      entering={FadeInDown.delay(delay).springify()}
      style={animatedStyle}
    >
      <AnimatedTouchable
        style={styles.menuButtonWrapper}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={disabled}
      >
        <LinearGradient
          colors={disabled ? ['#9CA3AF', '#6B7280'] : gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.menuButton}
        >
          {/* Decorative circles */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          
          <View style={styles.menuButtonContent}>
            <View style={styles.iconCircle}>
              <IconSymbol
                ios_icon_name={icon}
                android_material_icon_name={icon}
                size={32}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.menuButtonText}>
              <Text style={styles.menuButtonTitle}>{title}</Text>
              <Text style={styles.menuButtonDescription}>{description}</Text>
            </View>
            <View style={styles.arrowContainer}>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={24}
                color="#FFFFFF"
              />
            </View>
          </View>
        </LinearGradient>
      </AnimatedTouchable>
    </Animated.View>
  );
}

export default function CartMenuScreen() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📄 CART MENU SCREEN - Component is rendering');
  console.log('═══════════════════════════════════════════════════════');
  
  const theme = useTheme();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOrderInProgress, setHasOrderInProgress] = useState(false);

  // Modal states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showProjectConfirmModal, setShowProjectConfirmModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showEmployeeConfirmModal, setShowEmployeeConfirmModal] = useState(false);

  // Project selection
  const [projectSearch, setProjectSearch] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchingProjects, setSearchingProjects] = useState(false);

  // Employee authentication
  const [cardDigits, setCardDigits] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [authenticatingEmployee, setAuthenticatingEmployee] = useState(false);

  useEffect(() => {
    console.log('CartMenuScreen: useEffect triggered - loading cart data');
    loadCartFromStorage();
    checkOrderInProgress();
  }, []);

  // Real-time project search as user types
  useEffect(() => {
    console.log('CartMenuScreen: Project search query changed:', projectSearch);
    
    if (projectSearch.trim().length >= 2) {
      console.log('CartMenuScreen: Triggering real-time project search');
      searchProjects();
    } else {
      console.log('CartMenuScreen: Search query too short, clearing results');
      setProjects([]);
    }
  }, [projectSearch]);

  const loadCartFromStorage = async () => {
    console.log('CartMenuScreen: Loading cart from storage');
    try {
      const cartData = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (cartData) {
        const parsedCart = JSON.parse(cartData);
        console.log('CartMenuScreen: ✅ Cart loaded from storage successfully');
        console.log('CartMenuScreen: Cart items count:', parsedCart.length);
        setCart(parsedCart);
      } else {
        console.log('CartMenuScreen: No cart data found in storage (cart is empty)');
      }
    } catch (error) {
      console.error('CartMenuScreen: ❌ Error loading cart from storage', error);
    } finally {
      setLoading(false);
      console.log('CartMenuScreen: Loading complete, screen should now display');
    }
  };

  const checkOrderInProgress = async () => {
    console.log('CartMenuScreen: Checking for order in progress');
    try {
      const orderState = await AsyncStorage.getItem(ORDER_STATE_KEY);
      if (orderState) {
        const state = JSON.parse(orderState);
        console.log('CartMenuScreen: Found order in progress', state);
        setHasOrderInProgress(true);
      } else {
        console.log('CartMenuScreen: No order in progress');
        setHasOrderInProgress(false);
      }
    } catch (error) {
      console.error('CartMenuScreen: Error checking order state', error);
      setHasOrderInProgress(false);
    }
  };

  const searchProjects = async () => {
    console.log('CartMenuScreen: Searching projects with query:', projectSearch);
    
    if (projectSearch.trim().length < 2) {
      return;
    }

    try {
      setSearchingProjects(true);
      
      const { data, error } = await supabase
        .from('projects')
        .select('id, external_id, address, zipcode, city')
        .or(`external_id.ilike.%${projectSearch}%,address.ilike.%${projectSearch}%`)
        .limit(10);
      
      if (error) {
        console.error('CartMenuScreen: Error searching projects', error);
        throw error;
      }
      
      console.log('CartMenuScreen: Projects found:', data?.length || 0);
      setProjects(data || []);
    } catch (error) {
      console.error('CartMenuScreen: Error searching projects', error);
    } finally {
      setSearchingProjects(false);
    }
  };

  const handleProjectSelect = (project: Project) => {
    console.log('CartMenuScreen: User selected project:', project.external_id);
    setSelectedProject(project);
    setShowProjectModal(false);
    setShowProjectConfirmModal(true);
  };

  const confirmProject = () => {
    console.log('CartMenuScreen: User confirmed project:', selectedProject?.external_id);
    setShowProjectConfirmModal(false);
    setShowEmployeeModal(true);
  };

  const authenticateEmployee = async () => {
    console.log('CartMenuScreen: Authenticating employee with card digits:', cardDigits);
    
    if (cardDigits.length < 1) {
      Alert.alert('Input Error', 'Please enter at least the last digit of your card');
      return;
    }

    try {
      setAuthenticatingEmployee(true);
      
      // Fetch all active employee cards
      const { data: cards, error } = await supabase
        .from('employee_cards')
        .select('employee_id, card_data, qr_code')
        .eq('status', 'active');
      
      if (error) {
        console.error('CartMenuScreen: Error fetching employee cards', error);
        throw error;
      }
      
      // Find matching card (last digits or employee_id)
      const matchingCard = cards?.find(card => {
        const cardNumber = card.card_data?.cardNumber;
        return cardNumber?.endsWith(cardDigits) || card.employee_id?.endsWith(cardDigits);
      });
      
      if (!matchingCard) {
        Alert.alert('Authentication Failed', 'Invalid card number. Please try again.');
        setAuthenticatingEmployee(false);
        return;
      }
      
      // Fetch employee details
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email, role, position')
        .eq('id', matchingCard.employee_id)
        .single();
      
      if (empError) {
        console.error('CartMenuScreen: Error fetching employee', empError);
        throw empError;
      }
      
      console.log('CartMenuScreen: Employee authenticated:', employee.id);
      setSelectedEmployee(employee);
      setShowEmployeeModal(false);
      setShowEmployeeConfirmModal(true);
    } catch (error) {
      console.error('CartMenuScreen: Error authenticating employee', error);
      Alert.alert('Error', 'Failed to authenticate. Please try again.');
    } finally {
      setAuthenticatingEmployee(false);
    }
  };

  const confirmEmployee = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ EMPLOYEE CONFIRMED - Navigating to POS');
    console.log('CartMenuScreen: User confirmed employee:', selectedEmployee?.id);
    console.log('CartMenuScreen: Project:', selectedProject?.external_id);
    console.log('═══════════════════════════════════════════════════════');
    setShowEmployeeConfirmModal(false);
    
    // Save order state
    const orderState = {
      projectId: selectedProject?.id,
      projectExternalId: selectedProject?.external_id,
      employeeId: selectedEmployee?.id,
      employeeName: `${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`,
      timestamp: new Date().toISOString(),
    };
    
    await AsyncStorage.setItem(ORDER_STATE_KEY, JSON.stringify(orderState));
    
    // Navigate to POS screen with project and employee info
    console.log('CartMenuScreen: Navigating to /pos with gathered info');
    router.push({
      pathname: '/pos',
      params: {
        projectId: selectedProject?.id,
        projectExternalId: selectedProject?.external_id,
        employeeId: selectedEmployee?.id,
        employeeName: `${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`,
      },
    });
  };

  const handleNewOrder = () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🛍️ NEW ORDER BUTTON CLICKED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('CartMenuScreen: User tapped New Order button');
    console.log('CartMenuScreen: Current cart items:', cart.length);
    
    // Reset states
    setProjectSearch('');
    setProjects([]);
    setSelectedProject(null);
    setCardDigits('');
    setSelectedEmployee(null);
    
    // Show project selection modal
    console.log('CartMenuScreen: Opening project selection modal');
    setShowProjectModal(true);
    console.log('═══════════════════════════════════════════════════════');
  };

  const handleResumeOrder = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 RESUME ORDER BUTTON CLICKED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('CartMenuScreen: User tapped Resume Order button');
    
    try {
      const orderState = await AsyncStorage.getItem(ORDER_STATE_KEY);
      if (orderState) {
        const state = JSON.parse(orderState);
        console.log('CartMenuScreen: Resuming order with state:', state);
        
        // Navigate to POS with saved state
        router.push({
          pathname: '/pos',
          params: {
            projectId: state.projectId,
            projectExternalId: state.projectExternalId,
            employeeId: state.employeeId,
            employeeName: state.employeeName,
          },
        });
      } else {
        console.log('CartMenuScreen: No order state found');
        Alert.alert('No Order Found', 'There is no order in progress to resume.');
      }
    } catch (error) {
      console.error('CartMenuScreen: Error resuming order', error);
      Alert.alert('Error', 'Failed to resume order. Please start a new order.');
    }
    console.log('═══════════════════════════════════════════════════════');
  };

  const handleOrderHistory = () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📜 ORDER HISTORY BUTTON CLICKED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('CartMenuScreen: User tapped Order History button');
    console.log('CartMenuScreen: Navigating to order history screen');
    router.push('/order-history');
    console.log('═══════════════════════════════════════════════════════');
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.sale_price * item.cartQuantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((sum, item) => sum + item.cartQuantity, 0);
  };

  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };

  console.log('CartMenuScreen: Rendering UI with cart items:', cart.length);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Cart Menu',
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
                  ios_icon_name="cart.fill"
                  android_material_icon_name="shopping-cart"
                  size={28}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Shopping Cart</Text>
                <Text style={styles.headerSubtitle}>Manage your orders</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Cart Summary Card */}
        {cart.length > 0 && (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <LinearGradient
              colors={[themeColors.card, themeColors.card + 'F0']}
              style={styles.cartSummaryCard}
            >
              <View style={styles.cartSummaryHeader}>
                <View style={[styles.summaryIconBadge, { backgroundColor: themeColors.primary + '20' }]}>
                  <IconSymbol
                    ios_icon_name="bag.fill"
                    android_material_icon_name="shopping-bag"
                    size={20}
                    color={themeColors.primary}
                  />
                </View>
                <Text style={[styles.cartSummaryTitle, { color: themeColors.text }]}>
                  Cart Summary
                </Text>
              </View>

              <View style={styles.cartSummaryContent}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryLabelContainer}>
                    <IconSymbol
                      ios_icon_name="cube.box"
                      android_material_icon_name="inventory"
                      size={16}
                      color={themeColors.textSecondary}
                    />
                    <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                      Items
                    </Text>
                  </View>
                  <View style={[styles.summaryValueBadge, { backgroundColor: themeColors.primary + '15' }]}>
                    <Text style={[styles.summaryValue, { color: themeColors.primary }]}>
                      {getCartItemCount()}
                    </Text>
                  </View>
                </View>

                <View style={[styles.summaryDivider, { backgroundColor: themeColors.border }]} />

                <View style={styles.summaryRow}>
                  <View style={styles.summaryLabelContainer}>
                    <IconSymbol
                      ios_icon_name="eurosign.circle"
                      android_material_icon_name="euro"
                      size={16}
                      color={themeColors.textSecondary}
                    />
                    <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                      Total
                    </Text>
                  </View>
                  <LinearGradient
                    colors={[themeColors.primary, themeColors.primary + 'DD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.totalBadge}
                  >
                    <Text style={styles.totalValue}>
                      {formatPrice(getCartTotal())}
                    </Text>
                  </LinearGradient>
                </View>
              </View>

              {/* Cart Items Preview */}
              <View style={[styles.cartItemsPreviewSection, { backgroundColor: themeColors.background + '80' }]}>
                <Text style={[styles.previewTitle, { color: themeColors.text }]}>
                  Items in Cart
                </Text>
                {cart.slice(0, 3).map((item, index) => (
                  <View key={`cart-item-${item.id}-${index}`} style={styles.cartItemPreview}>
                    {item.photo ? (
                      <Image
                        source={{ uri: item.photo }}
                        style={styles.cartItemImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.cartItemImagePlaceholder, { backgroundColor: themeColors.border }]}>
                        <IconSymbol
                          ios_icon_name="photo"
                          android_material_icon_name="image"
                          size={16}
                          color={themeColors.textSecondary}
                        />
                      </View>
                    )}
                    <View style={styles.cartItemInfo}>
                      <Text style={[styles.cartItemName, { color: themeColors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.cartItemQuantity, { color: themeColors.textSecondary }]}>
                        Qty: {item.cartQuantity} • {formatPrice(item.sale_price * item.cartQuantity)}
                      </Text>
                    </View>
                  </View>
                ))}
                {cart.length > 3 && (
                  <Text style={[styles.moreItemsText, { color: themeColors.textSecondary }]}>
                    +{cart.length - 3} more {cart.length - 3 === 1 ? 'item' : 'items'}
                  </Text>
                )}
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Empty Cart State */}
        {cart.length === 0 && !loading && (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <View style={[styles.emptyCartCard, { backgroundColor: themeColors.card }]}>
              <LinearGradient
                colors={[themeColors.primary + '20', themeColors.primary + '10']}
                style={styles.emptyCartIconContainer}
              >
                <IconSymbol
                  ios_icon_name="cart"
                  android_material_icon_name="shopping-cart"
                  size={64}
                  color={themeColors.primary}
                />
              </LinearGradient>
              <Text style={[styles.emptyCartText, { color: themeColors.text }]}>
                Your cart is empty
              </Text>
              <Text style={[styles.emptyCartSubtext, { color: themeColors.textSecondary }]}>
                Start a new order to add products
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Menu Buttons */}
        <View style={styles.menuContainer}>
          {hasOrderInProgress && (
            <MenuButton
              title="Resume Order"
              description="Continue where you left off"
              icon="refresh"
              gradientColors={['#F59E0B', '#D97706']}
              onPress={handleResumeOrder}
              delay={150}
            />
          )}

          <MenuButton
            title="Create New Order"
            description="Select project and employee to start shopping"
            icon="add-shopping-cart"
            gradientColors={['#10B981', '#059669']}
            onPress={handleNewOrder}
            delay={200}
          />

          <MenuButton
            title="Order History"
            description="View your past orders and their status"
            icon="history"
            gradientColors={['#6366F1', '#8B5CF6']}
            onPress={handleOrderHistory}
            delay={300}
          />
        </View>
      </ScrollView>

      {/* Project Selection Modal */}
      <Modal
        visible={showProjectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProjectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Select Project
              </Text>
              <TouchableOpacity
                onPress={() => setShowProjectModal(false)}
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

            <View style={[styles.searchContainer, { backgroundColor: themeColors.card }]}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={20}
                color={themeColors.textSecondary}
              />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Type project ID or address..."
                placeholderTextColor={themeColors.textSecondary}
                value={projectSearch}
                onChangeText={setProjectSearch}
              />
              {searchingProjects && (
                <ActivityIndicator size="small" color={themeColors.primary} />
              )}
            </View>

            <Text style={[styles.searchHint, { color: themeColors.textSecondary }]}>
              {projectSearch.length < 2 
                ? 'Type at least 2 characters to search' 
                : `${projects.length} project${projects.length === 1 ? '' : 's'} found`}
            </Text>

            <ScrollView style={styles.projectsList}>
              {projects.map((project, index) => (
                <TouchableOpacity
                  key={`project-${index}`}
                  style={[styles.projectItem, { backgroundColor: themeColors.card }]}
                  onPress={() => handleProjectSelect(project)}
                >
                  <View style={styles.projectItemContent}>
                    <View style={[styles.projectIconBadge, { backgroundColor: themeColors.primary + '20' }]}>
                      <IconSymbol
                        ios_icon_name="building.2"
                        android_material_icon_name="business"
                        size={20}
                        color={themeColors.primary}
                      />
                    </View>
                    <View style={styles.projectItemText}>
                      <Text style={[styles.projectItemId, { color: themeColors.primary }]}>
                        {project.external_id}
                      </Text>
                      <Text style={[styles.projectItemAddress, { color: themeColors.text }]}>
                        {project.address}
                      </Text>
                      <Text style={[styles.projectItemCity, { color: themeColors.textSecondary }]}>
                        {project.zipcode} {project.city}
                      </Text>
                    </View>
                  </View>
                  <IconSymbol
                    ios_icon_name="chevron.right"
                    android_material_icon_name="arrow-forward"
                    size={20}
                    color={themeColors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Project Confirmation Modal */}
      <Modal
        visible={showProjectConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowProjectConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalContent, { backgroundColor: themeColors.background }]}>
            <LinearGradient
              colors={[themeColors.primary + '20', themeColors.primary + '10']}
              style={styles.confirmIconContainer}
            >
              <IconSymbol
                ios_icon_name="building.2"
                android_material_icon_name="business"
                size={48}
                color={themeColors.primary}
              />
            </LinearGradient>
            <Text style={[styles.confirmTitle, { color: themeColors.text }]}>
              Confirm Project
            </Text>
            <Text style={[styles.confirmMessage, { color: themeColors.textSecondary }]}>
              Is this the exact project you want to shop for?
            </Text>
            {selectedProject && (
              <View style={[styles.confirmDetails, { backgroundColor: themeColors.card }]}>
                <Text style={[styles.confirmDetailId, { color: themeColors.primary }]}>
                  {selectedProject.external_id}
                </Text>
                <Text style={[styles.confirmDetailAddress, { color: themeColors.text }]}>
                  {selectedProject.address}
                </Text>
                <Text style={[styles.confirmDetailCity, { color: themeColors.textSecondary }]}>
                  {selectedProject.zipcode} {selectedProject.city}
                </Text>
              </View>
            )}
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton, { backgroundColor: themeColors.card }]}
                onPress={() => {
                  setShowProjectConfirmModal(false);
                  setShowProjectModal(true);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: themeColors.text }]}>
                  Go Back
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonPrimary, { backgroundColor: themeColors.primary }]}
                onPress={confirmProject}
              >
                <Text style={styles.confirmButtonText}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Employee Authentication Modal */}
      <Modal
        visible={showEmployeeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEmployeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Employee Identification
              </Text>
              <TouchableOpacity
                onPress={() => setShowEmployeeModal(false)}
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

            <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
              Enter the last digit(s) of your employee card number
            </Text>

            <View style={[styles.searchContainer, { backgroundColor: themeColors.card }]}>
              <IconSymbol
                ios_icon_name="creditcard"
                android_material_icon_name="credit-card"
                size={20}
                color={themeColors.textSecondary}
              />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Last digit(s) of card..."
                placeholderTextColor={themeColors.textSecondary}
                value={cardDigits}
                onChangeText={setCardDigits}
                keyboardType="numeric"
                maxLength={4}
                onSubmitEditing={authenticateEmployee}
              />
            </View>

            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: themeColors.primary }]}
              onPress={authenticateEmployee}
              disabled={authenticatingEmployee || cardDigits.length < 1}
            >
              {authenticatingEmployee ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <React.Fragment>
                  <IconSymbol
                    ios_icon_name="person.circle"
                    android_material_icon_name="person"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.searchButtonText}>Authenticate</Text>
                </React.Fragment>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Employee Confirmation Modal */}
      <Modal
        visible={showEmployeeConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEmployeeConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalContent, { backgroundColor: themeColors.background }]}>
            <LinearGradient
              colors={['#10B981' + '20', '#10B981' + '10']}
              style={styles.confirmIconContainer}
            >
              <IconSymbol
                ios_icon_name="person.circle"
                android_material_icon_name="person"
                size={48}
                color="#10B981"
              />
            </LinearGradient>
            <Text style={[styles.confirmTitle, { color: themeColors.text }]}>
              Confirm Employee
            </Text>
            <Text style={[styles.confirmMessage, { color: themeColors.textSecondary }]}>
              Is this you?
            </Text>
            {selectedEmployee && (
              <View style={[styles.confirmDetails, { backgroundColor: themeColors.card }]}>
                <Text style={[styles.confirmDetailId, { color: '#10B981' }]}>
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </Text>
                <Text style={[styles.confirmDetailAddress, { color: themeColors.text }]}>
                  {selectedEmployee.position}
                </Text>
                <Text style={[styles.confirmDetailCity, { color: themeColors.textSecondary }]}>
                  {selectedEmployee.role}
                </Text>
              </View>
            )}
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton, { backgroundColor: themeColors.card }]}
                onPress={() => {
                  setShowEmployeeConfirmModal(false);
                  setShowEmployeeModal(true);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: themeColors.text }]}>
                  Go Back
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonPrimary, { backgroundColor: themeColors.primary }]}
                onPress={confirmEmployee}
              >
                <Text style={styles.confirmButtonText}>
                  Confirm & Shop
                </Text>
              </TouchableOpacity>
            </View>
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
  scrollContent: {
    paddingTop: Platform.OS === 'android' ? 48 : spacing.md,
    padding: spacing.lg,
    paddingBottom: 120,
  },
  headerGradient: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    ...shadows.large,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  cartSummaryCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    ...shadows.large,
  },
  cartSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartSummaryTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cartSummaryContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  summaryLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  summaryValueBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  totalBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cartItemsPreviewSection: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cartItemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cartItemImage: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
  },
  cartItemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  cartItemQuantity: {
    fontSize: 11,
  },
  moreItemsText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  emptyCartCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadows.medium,
  },
  emptyCartIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyCartText: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptyCartSubtext: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  menuContainer: {
    gap: spacing.lg,
  },
  menuButtonWrapper: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  menuButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.large,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  menuButtonText: {
    flex: 1,
  },
  menuButtonTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  menuButtonDescription: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 18,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalDescription: {
    fontSize: 15,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  searchHint: {
    fontSize: 13,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  projectsList: {
    maxHeight: 400,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  projectItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  projectIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectItemText: {
    flex: 1,
  },
  projectItemId: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  projectItemAddress: {
    fontSize: 14,
    marginBottom: 2,
  },
  projectItemCity: {
    fontSize: 12,
  },
  confirmModalContent: {
    width: '90%',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.large,
  },
  confirmIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  confirmDetails: {
    width: '100%',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  confirmDetailId: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  confirmDetailAddress: {
    fontSize: 15,
    marginBottom: 4,
    textAlign: 'center',
  },
  confirmDetailCity: {
    fontSize: 13,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    ...shadows.small,
  },
  confirmButtonPrimary: {
    ...shadows.medium,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
