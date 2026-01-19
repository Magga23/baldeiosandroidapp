
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useNearbyProjects, NearbyProject } from '@/hooks/useNearbyProjects';

interface ActiveEntry {
  id: string;
  employee: string;
  start_time: string;
  task: string;
  project_external_id?: string;
  project_address?: string;
  project_id?: string;
}

interface TimeEntryLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
}

// Waving radiation circle component
function WaveCircle({ delay, size, color }: { delay: number; size: number; color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    // Add initial delay before starting animation
    const timer = setTimeout(() => {
      scale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.8, { duration: 2000, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      );
      
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 0 }),
          withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      );
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.waveCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          borderWidth: 3,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function TimeEntryScreen() {
  console.log('TimeEntryScreen: Rendering clock in/out screen');
  const theme = useTheme();
  const { user } = useAuth();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;
  const { findNearbyProjects } = useNearbyProjects();

  const [loading, setLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [activeEntry, setActiveEntry] = useState<ActiveEntry | null>(null);
  const [currentTimer, setCurrentTimer] = useState(0);
  const [employeeName, setEmployeeName] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  
  // Project selection state
  const [selectedProject, setSelectedProject] = useState<NearbyProject | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [nearbyProjects, setNearbyProjects] = useState<NearbyProject[]>([]);
  const [allProjects, setAllProjects] = useState<NearbyProject[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    console.log('TimeEntryScreen: Component mounted, checking for active entry');
    checkActiveEntry();
    fetchEmployeeName();
    updateCurrentDate();
    
    // Update date every minute
    const dateInterval = setInterval(updateCurrentDate, 60000);
    return () => clearInterval(dateInterval);
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTracking && activeEntry) {
      interval = setInterval(() => {
        const startTime = new Date(activeEntry.start_time).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setCurrentTimer(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTracking, activeEntry]);

  const updateCurrentDate = () => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    console.log('TimeEntryScreen: Updated current date:', formattedDate);
    setCurrentDate(formattedDate);
  };

  const fetchEmployeeName = async () => {
    console.log('TimeEntryScreen: Fetching employee name from profiles table for user:', user?.id);
    if (!user?.id) {
      console.log('TimeEntryScreen: No user ID available');
      return;
    }

    try {
      // Fetch from profiles table instead of employees table
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, username')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('TimeEntryScreen: Profile not found in profiles table, error:', error);
        // Use email as fallback if profile not found
        setEmployeeName(user.email || user.id);
      } else if (data) {
        // Use full_name if available, otherwise username, otherwise email
        const displayName = data.full_name || data.username || data.email || user.id;
        console.log('TimeEntryScreen: Employee name fetched from profiles:', displayName);
        setEmployeeName(displayName);
      }
    } catch (error) {
      console.error('TimeEntryScreen: Error fetching employee name from profiles', error);
      // Use email as fallback
      setEmployeeName(user.email || user.id);
    }
  };

  const checkActiveEntry = async () => {
    console.log('TimeEntryScreen: Checking for active time entry');
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1);

      if (error) {
        console.error('TimeEntryScreen: Error checking active entry', error);
      } else if (data && data.length > 0) {
        console.log('TimeEntryScreen: Found active entry', data[0]);
        setActiveEntry(data[0]);
        setIsTracking(true);
      } else {
        console.log('TimeEntryScreen: No active entry found');
      }
    } catch (error) {
      console.error('TimeEntryScreen: Error checking active entry', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocation = async (): Promise<TimeEntryLocation | null> => {
    console.log('TimeEntryScreen: Requesting location permission');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('TimeEntryScreen: Location permission denied');
        return null;
      }

      console.log('TimeEntryScreen: Getting current location');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      console.log('TimeEntryScreen: Location obtained:', location.coords.latitude, location.coords.longitude);
      
      // Try to get address from reverse geocoding
      let address = `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
      
      try {
        console.log('TimeEntryScreen: Attempting reverse geocoding');
        const geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        console.log('TimeEntryScreen: Reverse geocode result:', geocode);
        
        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          console.log('TimeEntryScreen: Geocoded place:', place);
          
          // Build a comprehensive address from available components
          const addressParts = [];
          
          if (place.streetNumber) addressParts.push(place.streetNumber);
          if (place.street) addressParts.push(place.street);
          
          const streetAddress = addressParts.join(' ');
          
          const cityParts = [];
          if (place.postalCode) cityParts.push(place.postalCode);
          if (place.city) cityParts.push(place.city);
          
          const cityAddress = cityParts.join(' ');
          
          const fullAddressParts = [];
          if (streetAddress) fullAddressParts.push(streetAddress);
          if (cityAddress) fullAddressParts.push(cityAddress);
          if (place.region) fullAddressParts.push(place.region);
          if (place.country) fullAddressParts.push(place.country);
          
          if (fullAddressParts.length > 0) {
            address = fullAddressParts.join(', ');
            console.log('TimeEntryScreen: Formatted address:', address);
          } else {
            console.log('TimeEntryScreen: No address components found, using coordinates');
          }
        } else {
          console.log('TimeEntryScreen: Reverse geocoding returned no results');
        }
      } catch (geocodeError) {
        console.error('TimeEntryScreen: Reverse geocoding failed:', geocodeError);
        console.log('TimeEntryScreen: Using coordinates as fallback address');
      }

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address,
      };
    } catch (error) {
      console.error('TimeEntryScreen: Error getting location', error);
      return null;
    }
  };

  const findProjectsNearUser = async () => {
    console.log('TimeEntryScreen: Finding projects near user location');
    setLocationLoading(true);
    
    try {
      const location = await getLocation();
      
      if (location) {
        setUserLocation({ latitude: location.latitude, longitude: location.longitude });

        // Find projects within 500m
        const nearby = await findNearbyProjects(location.latitude, location.longitude, 500);
        setNearbyProjects(nearby);
        console.log('TimeEntryScreen: Found', nearby.length, 'nearby projects');
      } else {
        console.log('TimeEntryScreen: Location permission denied, showing all projects for manual selection');
        setNearbyProjects([]);
      }

      // Always fetch all projects for manual selection (whether location is available or not)
      const { data: allProjectsData, error } = await supabase
        .from('projects')
        .select('id, external_id, address, zipcode, city, plz, stadt, latitude, longitude, status')
        .order('external_id', { ascending: false });

      if (!error && allProjectsData) {
        const formattedProjects = allProjectsData.map((p) => ({
          id: p.id,
          external_id: p.external_id,
          address: p.address || '',
          zipcode: p.zipcode || p.plz || '',
          city: p.city || p.stadt || '',
          latitude: p.latitude,
          longitude: p.longitude,
          status: p.status,
          distance: 0,
        }));
        setAllProjects(formattedProjects);
        console.log('TimeEntryScreen: Loaded', formattedProjects.length, 'total projects');
      }

      // Always show the modal, even if location permission was denied
      console.log('TimeEntryScreen: Opening project selection modal');
      setShowProjectModal(true);
    } catch (error) {
      console.error('TimeEntryScreen: Error finding nearby projects', error);
      Alert.alert('Error', 'Could not load projects. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleClockInOut = async () => {
    console.log('TimeEntryScreen: User tapped Clock In/Out button');
    
    if (isTracking) {
      // Clock out
      handleClockOut();
    } else {
      // Clock in - trigger project fetching
      console.log('TimeEntryScreen: Triggering project fetching for clock in');
      await findProjectsNearUser();
    }
  };

  const handleClockIn = async () => {
    console.log('TimeEntryScreen: User confirmed project, clocking in');
    if (!selectedProject) {
      console.log('TimeEntryScreen: No project selected');
      Alert.alert('Error', 'Please select a project');
      return;
    }

    if (!user?.id) {
      console.log('TimeEntryScreen: No user ID available');
      Alert.alert('Error', 'User not authenticated. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      const location = await getLocation();
      
      console.log('TimeEntryScreen: Clock in location:', location);
      
      // ✅ FIXED: Use user.id (UUID from profiles table) instead of email or name
      const body = {
        employee: user.id, // UUID from profiles.id (e.g., "144922e2-2ff2-40ab-b1bf-136b21385138")
        start_time: new Date().toISOString(),
        task: 'Work on project',
        project_id: selectedProject.id,
        project_external_id: selectedProject.external_id,
        project_address: `${selectedProject.address}, ${selectedProject.zipcode} ${selectedProject.city}`,
        location: location,
      };

      console.log('TimeEntryScreen: Creating time entry with employee UUID:', user.id);

      const { data, error } = await supabase
        .from('time_entries')
        .insert(body)
        .select()
        .single();

      if (error) {
        console.error('TimeEntryScreen: Clock in failed with error:', error);
        Alert.alert('Error', `Failed to clock in: ${error.message}`);
      } else {
        console.log('TimeEntryScreen: Clock in successful', data);
        setActiveEntry(data);
        setIsTracking(true);
        setShowProjectModal(false);
        setSearchQuery(''); // Clear search when closing modal
        Alert.alert('Success', 'Clocked in successfully!');
      }
    } catch (error) {
      console.error('TimeEntryScreen: Error clocking in', error);
      Alert.alert('Error', 'Failed to clock in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    console.log('TimeEntryScreen: User tapped Clock Out button');
    if (!activeEntry) {
      console.error('TimeEntryScreen: No active entry to clock out');
      return;
    }

    try {
      setLoading(true);
      const location = await getLocation();
      
      console.log('TimeEntryScreen: Clock out location:', location);
      
      const endTime = new Date();
      const startTime = new Date(activeEntry.start_time);
      const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      const body = {
        end_time: endTime.toISOString(),
        duration: parseFloat(durationHours.toFixed(2)),
        end_location: location,
      };

      console.log('TimeEntryScreen: Updating time entry', activeEntry.id, body);

      const { error } = await supabase
        .from('time_entries')
        .update(body)
        .eq('id', activeEntry.id);

      if (error) {
        console.error('TimeEntryScreen: Clock out failed', error);
        Alert.alert('Error', 'Failed to clock out. Please try again.');
      } else {
        console.log('TimeEntryScreen: Clock out successful');
        setActiveEntry(null);
        setIsTracking(false);
        setCurrentTimer(0);
        setSelectedProject(null);
        Alert.alert('Success', 'Clocked out successfully!');
      }
    } catch (error) {
      console.error('TimeEntryScreen: Error clocking out', error);
      Alert.alert('Error', 'Failed to clock out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Filter projects based on search query
  const getFilteredProjects = (projects: NearbyProject[]) => {
    if (!searchQuery.trim()) {
      return projects;
    }
    
    const query = searchQuery.toLowerCase();
    return projects.filter((project) => {
      const externalId = project.external_id?.toLowerCase() || '';
      const address = project.address?.toLowerCase() || '';
      const city = project.city?.toLowerCase() || '';
      const zipcode = project.zipcode?.toLowerCase() || '';
      
      return (
        externalId.includes(query) ||
        address.includes(query) ||
        city.includes(query) ||
        zipcode.includes(query)
      );
    });
  };

  const renderProjectItem = ({ item }: { item: NearbyProject }) => (
    <TouchableOpacity
      style={[
        styles.projectItem,
        { backgroundColor: themeColors.card, borderColor: themeColors.border },
        selectedProject?.id === item.id && { borderColor: themeColors.primary, borderWidth: 2 },
      ]}
      onPress={() => {
        console.log('TimeEntryScreen: User selected project', item.external_id);
        setSelectedProject(item);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.projectItemHeader}>
        <Text style={[styles.projectItemTitle, { color: themeColors.text }]}>
          {item.external_id}
        </Text>
        {item.distance > 0 && (
          <View style={[styles.distanceBadge, { backgroundColor: themeColors.primary + '20' }]}>
            <IconSymbol
              ios_icon_name="location.fill"
              android_material_icon_name="location-on"
              size={14}
              color={themeColors.primary}
            />
            <Text style={[styles.distanceText, { color: themeColors.primary }]}>
              {formatDistance(item.distance)}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.projectItemAddress, { color: themeColors.textSecondary }]}>
        {item.address}
      </Text>
      <Text style={[styles.projectItemCity, { color: themeColors.textSecondary }]}>
        {item.zipcode} {item.city}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Clock In/Out',
          headerBackTitle: 'Back',
          headerRight: () => (
            <View style={styles.headerRight}>
              {employeeName ? (
                <View style={[styles.employeeBadge, { backgroundColor: themeColors.primary + '20' }]}>
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={16}
                    color={themeColors.primary}
                  />
                  <Text style={[styles.employeeName, { color: themeColors.primary }]}>
                    {employeeName}
                  </Text>
                </View>
              ) : null}
            </View>
          ),
          headerStyle: {
            backgroundColor: themeColors.card,
          },
          headerTintColor: themeColors.text,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Display */}
        {currentDate && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={[styles.dateCard, { backgroundColor: themeColors.card }]}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="calendar-today"
                size={20}
                color={themeColors.primary}
              />
              <Text style={[styles.dateText, { color: themeColors.text }]}>
                {currentDate}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Timer Display */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.timerCard}>
            <View style={styles.timerCircleContainer}>
              <LinearGradient
                colors={isTracking 
                  ? [themeColors.primary, themeColors.primaryDark] 
                  : [themeColors.card, themeColors.card]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.timerCircle, shadows.large]}
              >
                <View style={[styles.timerInnerCircle, { backgroundColor: themeColors.background }]}>
                  <Text style={[styles.timerText, { color: isTracking ? themeColors.primary : themeColors.text }]}>
                    {formatTime(currentTimer)}
                  </Text>
                  <Text style={[styles.timerLabel, { color: themeColors.textSecondary }]}>
                    {isTracking ? 'Recording' : 'Ready'}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {isTracking && activeEntry && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.activeInfo}>
                <View style={[styles.activeInfoCard, { backgroundColor: themeColors.card }]}>
                  <View style={styles.activeInfoRow}>
                    <IconSymbol
                      ios_icon_name="briefcase.fill"
                      android_material_icon_name="work"
                      size={18}
                      color={themeColors.primary}
                    />
                    <Text style={[styles.activeInfoLabel, { color: themeColors.text }]}>
                      Task: {activeEntry.task}
                    </Text>
                  </View>
                  {activeEntry.project_external_id && (
                    <View style={styles.activeInfoRow}>
                      <IconSymbol
                        ios_icon_name="building.2"
                        android_material_icon_name="business"
                        size={18}
                        color={themeColors.primary}
                      />
                      <Text style={[styles.activeInfoLabel, { color: themeColors.text }]}>
                        Project: {activeEntry.project_external_id}
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>

        {/* Project Info (when selected but not tracking) */}
        {!isTracking && selectedProject && (
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <View style={[styles.selectedProjectCard, { backgroundColor: themeColors.card }]}>
              <View style={styles.selectedProjectHeader}>
                <IconSymbol
                  ios_icon_name="building.2"
                  android_material_icon_name="business"
                  size={24}
                  color={themeColors.primary}
                />
                <Text style={[styles.selectedProjectTitle, { color: themeColors.text }]}>
                  Selected Project
                </Text>
              </View>
              <Text style={[styles.selectedProjectId, { color: themeColors.primary }]}>
                {selectedProject.external_id}
              </Text>
              <Text style={[styles.selectedProjectAddress, { color: themeColors.textSecondary }]}>
                {selectedProject.address}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Round Action Button with Wave Radiation */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.buttonContainer}>
          <View style={styles.roundButtonWrapper}>
            {/* Wave radiation circles - show for BOTH clock in and clock out */}
            <View style={styles.waveContainer}>
              <WaveCircle 
                delay={0} 
                size={240} 
                color={isTracking ? themeColors.error : themeColors.success} 
              />
              <WaveCircle 
                delay={700} 
                size={240} 
                color={isTracking ? themeColors.error : themeColors.success} 
              />
              <WaveCircle 
                delay={1400} 
                size={240} 
                color={isTracking ? themeColors.error : themeColors.success} 
              />
            </View>
            
            {/* Main round button */}
            <TouchableOpacity
              style={styles.roundButton}
              onPress={handleClockInOut}
              disabled={loading || locationLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isTracking 
                  ? [themeColors.error, themeColors.errorDark] 
                  : [themeColors.success, themeColors.successDark]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.roundButtonGradient}
              >
                {(loading || locationLoading) ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : (
                  <React.Fragment>
                    <IconSymbol
                      ios_icon_name={isTracking ? 'stop.fill' : 'play.fill'}
                      android_material_icon_name={isTracking ? 'stop' : 'play-arrow'}
                      size={32}
                      color="#FFFFFF"
                    />
                    <Text style={styles.roundButtonText}>
                      {isTracking ? 'Clock Out' : 'Clock In'}
                    </Text>
                  </React.Fragment>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Project Selection Modal */}
      <Modal
        visible={showProjectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          console.log('TimeEntryScreen: User closed project selection modal');
          setShowProjectModal(false);
          setSearchQuery(''); // Clear search when closing modal
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Select Project
              </Text>
              <TouchableOpacity
                onPress={() => {
                  console.log('TimeEntryScreen: User closed project selection modal');
                  setShowProjectModal(false);
                  setSearchQuery(''); // Clear search when closing modal
                }}
                style={styles.modalCloseButton}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={themeColors.text}
                />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: themeColors.card }]}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={20}
                color={themeColors.textSecondary}
              />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Search projects by ID, address, or city..."
                placeholderTextColor={themeColors.textSecondary}
                value={searchQuery}
                onChangeText={(text) => {
                  console.log('TimeEntryScreen: User searching for:', text);
                  setSearchQuery(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    console.log('TimeEntryScreen: User cleared search');
                    setSearchQuery('');
                  }}
                  style={styles.clearSearchButton}
                >
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={20}
                    color={themeColors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Nearby Projects Section */}
            {nearbyProjects.length > 0 && (
              <View style={styles.nearbySection}>
                <View style={[styles.nearbySectionHeader, { backgroundColor: themeColors.primary + '20' }]}>
                  <IconSymbol
                    ios_icon_name="location.fill"
                    android_material_icon_name="location-on"
                    size={20}
                    color={themeColors.primary}
                  />
                  <Text style={[styles.nearbySectionTitle, { color: themeColors.primary }]}>
                    Nearby Projects (within 500m)
                  </Text>
                </View>
                <FlatList
                  data={getFilteredProjects(nearbyProjects)}
                  renderItem={renderProjectItem}
                  keyExtractor={(item) => item.id}
                  style={styles.projectList}
                  contentContainerStyle={styles.projectListContent}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                        No projects match your search
                      </Text>
                    </View>
                  }
                />
              </View>
            )}

            {/* Manual Selection Section */}
            {nearbyProjects.length === 0 && (
              <View style={styles.manualSection}>
                <View style={[styles.infoBox, { backgroundColor: themeColors.warning + '20', borderColor: themeColors.warning }]}>
                  <IconSymbol
                    ios_icon_name="info.circle.fill"
                    android_material_icon_name="info"
                    size={20}
                    color={themeColors.warning}
                  />
                  <Text style={[styles.infoBoxText, { color: themeColors.text }]}>
                    {userLocation 
                      ? 'No nearby projects found. Select manually:' 
                      : 'Location permission denied. Please select a project manually:'}
                  </Text>
                </View>
                <FlatList
                  data={getFilteredProjects(allProjects)}
                  renderItem={renderProjectItem}
                  keyExtractor={(item) => item.id}
                  style={styles.projectList}
                  contentContainerStyle={styles.projectListContent}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                        No projects match your search
                      </Text>
                    </View>
                  }
                />
              </View>
            )}

            {/* Confirm Button */}
            {selectedProject && (
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: themeColors.primary }]}
                onPress={() => {
                  console.log('TimeEntryScreen: User tapped Confirm & Clock In button');
                  handleClockIn();
                }}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <React.Fragment>
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={24}
                      color="#FFFFFF"
                    />
                    <Text style={styles.confirmButtonText}>
                      Confirm & Clock In
                    </Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 120,
  },
  headerRight: {
    marginRight: spacing.sm,
  },
  employeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  employeeName: {
    fontSize: 13,
    fontWeight: '700',
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  dateText: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 15,
  },
  timerCard: {
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timerCircleContainer: {
    marginBottom: spacing.lg,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerInnerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 92,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    ...typography.h1,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 2,
  },
  timerLabel: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  activeInfo: {
    width: '100%',
    alignItems: 'center',
  },
  activeInfoCard: {
    width: '100%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.medium,
  },
  activeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeInfoLabel: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  selectedProjectCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  selectedProjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  selectedProjectTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  selectedProjectId: {
    ...typography.h3,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  selectedProjectAddress: {
    ...typography.body,
  },
  buttonContainer: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  roundButtonWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 240,
    height: 240,
  },
  waveContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: 240,
    height: 240,
  },
  waveCircle: {
    position: 'absolute',
  },
  roundButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    ...shadows.large,
    elevation: 8,
  },
  roundButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roundButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.small,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.xs,
  },
  clearSearchButton: {
    padding: spacing.xs,
  },
  nearbySection: {
    maxHeight: '60%',
  },
  nearbySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
  },
  nearbySectionTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  manualSection: {
    flex: 1,
    paddingTop: spacing.sm,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  infoBoxText: {
    ...typography.body,
    flex: 1,
    fontWeight: '600',
  },
  projectList: {
    flex: 1,
  },
  projectListContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  projectItem: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  projectItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  projectItemTitle: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  distanceText: {
    ...typography.bodySmall,
    fontWeight: '700',
    fontSize: 12,
  },
  projectItemAddress: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  projectItemCity: {
    ...typography.bodySmall,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  confirmButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
