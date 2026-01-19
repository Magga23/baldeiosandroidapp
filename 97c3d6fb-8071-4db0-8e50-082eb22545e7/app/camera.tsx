
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:8082';

interface Project {
  id: string;
  external_id: string;
  address: string;
  zipcode: string;
  city: string;
}

interface CapturedImage {
  uri: string;
  timestamp: Date;
  notes?: string;
  projectId?: string;
  projectAddress?: string;
  employeeId?: string;
  employeeName?: string;
  uploadedUrl?: string;
  backendPhotoId?: string;
}

export default function CameraScreen() {
  const theme = useTheme();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;
  const { user } = useAuth();

  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [currentNotes, setCurrentNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<CapturedImage | null>(null);

  // Project picker modal state
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Confirmation modal state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingAction, setPendingAction] = useState<'camera' | 'gallery' | null>(null);

  useEffect(() => {
    console.log('CameraScreen: Component mounted');
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    console.log('CameraScreen: Requesting camera and location permissions');
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      console.log('CameraScreen: Camera permissions denied');
      Alert.alert(
        'Permissions Required',
        'Camera and media library permissions are required to document projects.',
        [{ text: 'OK' }]
      );
    } else {
      console.log('CameraScreen: Camera permissions granted');
    }
    
    if (locationStatus !== 'granted') {
      console.log('CameraScreen: Location permission denied');
    }
  };

  const searchProjects = async (query: string) => {
    console.log('CameraScreen: Searching projects with query:', query);
    try {
      setLoadingProjects(true);
      
      let queryBuilder = supabase
        .from('projects')
        .select('id, external_id, address, zipcode, city');
      
      if (query.trim()) {
        queryBuilder = queryBuilder.or(`external_id.ilike.%${query}%,address.ilike.%${query}%,city.ilike.%${query}%`);
      }
      
      const { data, error } = await queryBuilder.limit(20);
      
      if (error) {
        console.error('CameraScreen: Error searching projects:', error);
        throw error;
      }
      
      console.log('CameraScreen: Found projects:', data?.length || 0);
      setProjects(data || []);
    } catch (error) {
      console.error('CameraScreen: Error searching projects:', error);
      Alert.alert('Error', 'Failed to search projects. Please try again.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleProjectSelect = (project: Project) => {
    console.log('CameraScreen: User selected project:', project.external_id);
    setSelectedProject(project);
    setShowConfirmation(true);
  };

  const confirmProject = () => {
    console.log('CameraScreen: User confirmed project:', selectedProject?.external_id);
    console.log('CameraScreen: Using authenticated user info for employee_id');
    setShowConfirmation(false);
    setShowProjectPicker(false);
    
    // Proceed directly with photo capture using authenticated user
    if (pendingAction === 'camera') {
      takePhotoNow();
    } else if (pendingAction === 'gallery') {
      pickFromGalleryNow();
    }
  };

  const initiatePhotoCapture = (action: 'camera' | 'gallery') => {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📸 INITIATE ${action.toUpperCase()} - Starting project selection flow`);
    console.log('═══════════════════════════════════════════════════════');
    
    setPendingAction(action);
    setShowProjectPicker(true);
    searchProjects('');
  };

  const uploadImageToBackend = async (imageUri: string, projectId: string, projectExternalId: string, projectAddress: string, notes: string) => {
    console.log('CameraScreen: Uploading image to backend API');
    console.log('CameraScreen: Using authenticated user ID:', user?.id);
    console.log('CameraScreen: Backend URL:', BACKEND_URL);
    
    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      
      // Add the image file
      const filename = `photo_${Date.now()}.jpg`;
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: filename,
      } as any);
      
      // Add metadata fields
      formData.append('projectId', projectExternalId);
      formData.append('projectAddress', projectAddress);
      formData.append('employeeId', user?.id || '');
      formData.append('employeeName', user?.email || 'Current User');
      formData.append('notes', notes || '');
      
      console.log('CameraScreen: Sending multipart request to /api/photos/upload');
      
      const response = await fetch(`${BACKEND_URL}/api/photos/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type - let the browser set it with boundary
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('CameraScreen: Backend upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('CameraScreen: ✅ Image uploaded to backend successfully:', result);
      
      return {
        photoUrl: result.photoUrl,
        photoId: result.id,
      };
    } catch (error) {
      console.error('CameraScreen: Error in uploadImageToBackend:', error);
      throw error;
    }
  };

  const takePhotoNow = async () => {
    console.log('CameraScreen: Taking photo with project context and authenticated user');
    
    try {
      setLoading(true);
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        
        // Upload to backend with authenticated user's ID
        if (selectedProject && user) {
          try {
            const projectAddress = `${selectedProject.address}, ${selectedProject.city}`;
            
            const { photoUrl, photoId } = await uploadImageToBackend(
              imageUri,
              selectedProject.id,
              selectedProject.external_id,
              projectAddress,
              ''
            );
            
            const newImage: CapturedImage = {
              uri: imageUri,
              timestamp: new Date(),
              notes: '',
              projectId: selectedProject.external_id,
              projectAddress: projectAddress,
              employeeId: user.id,
              employeeName: user.email || 'Current User',
              uploadedUrl: photoUrl,
              backendPhotoId: photoId,
            };
            
            console.log('CameraScreen: Photo captured and uploaded successfully');
            
            setCapturedImages(prev => [newImage, ...prev]);
            setSelectedImage(newImage);
            setCurrentNotes('');
            
            Alert.alert(
              'Photo Captured & Uploaded!',
              `Photo linked to project: ${selectedProject?.external_id}\nCreated by: ${newImage.employeeName}`,
              [{ text: 'OK' }]
            );
          } catch (uploadError) {
            console.error('CameraScreen: Upload failed:', uploadError);
            
            // Still save locally even if upload fails
            const newImage: CapturedImage = {
              uri: imageUri,
              timestamp: new Date(),
              notes: '',
              projectId: selectedProject.external_id,
              projectAddress: `${selectedProject.address}, ${selectedProject.city}`,
              employeeId: user.id,
              employeeName: user.email || 'Current User',
            };
            
            setCapturedImages(prev => [newImage, ...prev]);
            setSelectedImage(newImage);
            setCurrentNotes('');
            
            Alert.alert(
              'Photo Saved Locally',
              'Photo was captured but could not be uploaded to the backend. Please check your connection.',
              [{ text: 'OK' }]
            );
          }
        }
      }
    } catch (error) {
      console.error('CameraScreen: Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setLoading(false);
      // Reset selections for next photo
      setSelectedProject(null);
    }
  };

  const pickFromGalleryNow = async () => {
    console.log('CameraScreen: Picking from gallery with project context and authenticated user');
    
    try {
      setLoading(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        
        // Upload to backend with authenticated user's ID
        if (selectedProject && user) {
          try {
            const projectAddress = `${selectedProject.address}, ${selectedProject.city}`;
            
            const { photoUrl, photoId } = await uploadImageToBackend(
              imageUri,
              selectedProject.id,
              selectedProject.external_id,
              projectAddress,
              ''
            );
            
            const newImage: CapturedImage = {
              uri: imageUri,
              timestamp: new Date(),
              notes: '',
              projectId: selectedProject.external_id,
              projectAddress: projectAddress,
              employeeId: user.id,
              employeeName: user.email || 'Current User',
              uploadedUrl: photoUrl,
              backendPhotoId: photoId,
            };
            
            console.log('CameraScreen: Image selected and uploaded successfully');
            setCapturedImages(prev => [newImage, ...prev]);
            setSelectedImage(newImage);
            setCurrentNotes('');
            
            Alert.alert(
              'Image Selected & Uploaded!',
              `Photo linked to project: ${selectedProject?.external_id}\nCreated by: ${newImage.employeeName}`,
              [{ text: 'OK' }]
            );
          } catch (uploadError) {
            console.error('CameraScreen: Upload failed:', uploadError);
            
            // Still save locally even if upload fails
            const newImage: CapturedImage = {
              uri: imageUri,
              timestamp: new Date(),
              notes: '',
              projectId: selectedProject.external_id,
              projectAddress: `${selectedProject.address}, ${selectedProject.city}`,
              employeeId: user.id,
              employeeName: user.email || 'Current User',
            };
            
            setCapturedImages(prev => [newImage, ...prev]);
            setSelectedImage(newImage);
            setCurrentNotes('');
            
            Alert.alert(
              'Image Saved Locally',
              'Image was selected but could not be uploaded to the backend. Please check your connection.',
              [{ text: 'OK' }]
            );
          }
        }
      }
    } catch (error) {
      console.error('CameraScreen: Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setLoading(false);
      setSelectedProject(null);
    }
  };

  const saveNotes = async () => {
    console.log('CameraScreen: User saving notes for image');
    if (selectedImage && selectedImage.backendPhotoId) {
      // Update notes in backend
      try {
        const response = await fetch(`${BACKEND_URL}/api/photos/${selectedImage.backendPhotoId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes: currentNotes }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update notes');
        }
        
        setCapturedImages(prev =>
          prev.map(img =>
            img.uri === selectedImage.uri
              ? { ...img, notes: currentNotes }
              : img
          )
        );
        console.log('CameraScreen: Notes saved to backend');
        
        Alert.alert('Notes Saved', 'Your notes have been saved to this image.', [{ text: 'OK' }]);
      } catch (error) {
        console.error('CameraScreen: Error saving notes:', error);
        Alert.alert('Error', 'Failed to save notes. Please try again.');
      }
    } else {
      // Just update local state if not uploaded yet
      setCapturedImages(prev =>
        prev.map(img =>
          img.uri === selectedImage?.uri
            ? { ...img, notes: currentNotes }
            : img
        )
      );
      Alert.alert('Notes Saved Locally', 'Notes saved. Upload the image to save to server.', [{ text: 'OK' }]);
    }
  };

  const deleteImage = (uri: string) => {
    console.log('CameraScreen: User deleting image:', uri);
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const imageToDelete = capturedImages.find(img => img.uri === uri);
            
            // If image was uploaded to backend, delete it from there too
            if (imageToDelete?.backendPhotoId) {
              try {
                const response = await fetch(`${BACKEND_URL}/api/photos/${imageToDelete.backendPhotoId}`, {
                  method: 'DELETE',
                });
                
                if (!response.ok) {
                  console.error('CameraScreen: Error deleting from backend');
                }
              } catch (error) {
                console.error('CameraScreen: Error deleting image:', error);
              }
            }
            
            setCapturedImages(prev => prev.filter(img => img.uri !== uri));
            if (selectedImage?.uri === uri) {
              setSelectedImage(null);
              setCurrentNotes('');
            }
            console.log('CameraScreen: Image deleted');
          },
        },
      ]
    );
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Document Project',
          headerStyle: {
            backgroundColor: themeColors.card,
          },
          headerTintColor: themeColors.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('CameraScreen: User tapped back button');
                router.back();
              }}
              style={styles.headerButton}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={themeColors.text}
              />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('CameraScreen: User tapped photo history button');
                router.push('/photo-history');
              }}
              style={styles.headerButton}
            >
              <IconSymbol
                ios_icon_name="photo.stack"
                android_material_icon_name="photo-library"
                size={24}
                color={themeColors.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Camera Controls */}
        <Animated.View entering={FadeInUp.duration(600)} style={styles.controlsSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Capture Documentation
          </Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.actionButtonWrapper}
              onPress={() => initiatePhotoCapture('camera')}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.actionButton, shadows.large]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="camera.fill"
                      android_material_icon_name="camera"
                      size={28}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Take Photo</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButtonWrapper}
              onPress={() => initiatePhotoCapture('gallery')}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[themeColors.primary, themeColors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.actionButton, shadows.large]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="photo.fill"
                      android_material_icon_name="image"
                      size={28}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>From Gallery</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Selected Project & User Info Cards */}
        {selectedImage && (selectedImage.projectId || selectedImage.employeeName) && (
          <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.contextSection}>
            {selectedImage.projectId && (
              <View style={[styles.contextCard, { backgroundColor: themeColors.card }, shadows.medium]}>
                <View style={[styles.contextIconContainer, { backgroundColor: themeColors.primary + '20' }]}>
                  <IconSymbol
                    ios_icon_name="building.2"
                    android_material_icon_name="business"
                    size={24}
                    color={themeColors.primary}
                  />
                </View>
                <View style={styles.contextInfo}>
                  <Text style={[styles.contextLabel, { color: themeColors.textSecondary }]}>
                    Project
                  </Text>
                  <Text style={[styles.contextValue, { color: themeColors.text }]}>
                    {selectedImage.projectId}
                  </Text>
                  {selectedImage.projectAddress && (
                    <Text style={[styles.contextSubtext, { color: themeColors.textSecondary }]}>
                      {selectedImage.projectAddress}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {selectedImage.employeeName && (
              <View style={[styles.contextCard, { backgroundColor: themeColors.card }, shadows.medium]}>
                <View style={[styles.contextIconContainer, { backgroundColor: '#10B981' + '20' }]}>
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={24}
                    color="#10B981"
                  />
                </View>
                <View style={styles.contextInfo}>
                  <Text style={[styles.contextLabel, { color: themeColors.textSecondary }]}>
                    Created By
                  </Text>
                  <Text style={[styles.contextValue, { color: themeColors.text }]}>
                    {selectedImage.employeeName}
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Selected Image Preview */}
        {selectedImage && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.previewSection}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              Selected Image
            </Text>
            
            <View style={[styles.previewCard, { backgroundColor: themeColors.card }, shadows.large]}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
              
              <View style={styles.previewInfo}>
                <Text style={[styles.previewTimestamp, { color: themeColors.textSecondary }]}>
                  {formatTimestamp(selectedImage.timestamp)}
                </Text>
                {selectedImage.uploadedUrl && (
                  <View style={styles.uploadedBadge}>
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={16}
                      color="#10B981"
                    />
                    <Text style={styles.uploadedText}>Uploaded</Text>
                  </View>
                )}
                {!selectedImage.uploadedUrl && (
                  <View style={styles.localBadge}>
                    <IconSymbol
                      ios_icon_name="exclamationmark.circle.fill"
                      android_material_icon_name="info"
                      size={16}
                      color="#F59E0B"
                    />
                    <Text style={styles.localText}>Local Only</Text>
                  </View>
                )}
              </View>

              <View style={styles.notesContainer}>
                <Text style={[styles.notesLabel, { color: themeColors.text }]}>
                  Add Notes:
                </Text>
                <TextInput
                  style={[styles.notesInput, { 
                    backgroundColor: themeColors.background,
                    color: themeColors.text,
                    borderColor: themeColors.border,
                  }]}
                  placeholder="Describe what's in this photo..."
                  placeholderTextColor={themeColors.textSecondary}
                  value={currentNotes}
                  onChangeText={setCurrentNotes}
                  multiline
                  numberOfLines={3}
                />
                
                <TouchableOpacity
                  style={styles.saveNotesButton}
                  onPress={saveNotes}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveNotesGradient}
                  >
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.saveNotesText}>Save Notes</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Recent Photos Preview */}
        {capturedImages.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Recent Photos ({capturedImages.length})
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/photo-history')}
                style={styles.viewAllButton}
              >
                <Text style={[styles.viewAllText, { color: themeColors.primary }]}>
                  View All
                </Text>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={16}
                  color={themeColors.primary}
                />
              </TouchableOpacity>
            </View>
            
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScroll}
            >
              {capturedImages.slice(0, 5).map((image, index) => (
                <TouchableOpacity
                  key={`recent-${index}`}
                  style={[
                    styles.recentItem,
                    { backgroundColor: themeColors.card },
                    shadows.medium,
                  ]}
                  onPress={() => {
                    setSelectedImage(image);
                    setCurrentNotes(image.notes || '');
                  }}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: image.uri }} style={styles.recentImage} />
                  {image.projectId && (
                    <View style={styles.recentBadge}>
                      <IconSymbol
                        ios_icon_name="building.2"
                        android_material_icon_name="business"
                        size={12}
                        color="#FFFFFF"
                      />
                    </View>
                  )}
                  {image.uploadedUrl && (
                    <View style={styles.recentUploadedBadge}>
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={16}
                        color="#10B981"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Empty State */}
        {capturedImages.length === 0 && !loading && (
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.emptyState}>
            <LinearGradient
              colors={[themeColors.primary + '20', themeColors.primary + '10']}
              style={styles.emptyIconContainer}
            >
              <IconSymbol
                ios_icon_name="camera.fill"
                android_material_icon_name="camera"
                size={64}
                color={themeColors.primary}
              />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              No Photos Yet
            </Text>
            <Text style={[styles.emptyDescription, { color: themeColors.textSecondary }]}>
              Take photos to document your project progress
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Project Picker Modal */}
      <Modal
        visible={showProjectPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProjectPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Select Project
              </Text>
              <TouchableOpacity
                onPress={() => setShowProjectPicker(false)}
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

            <View style={[styles.searchBar, { backgroundColor: themeColors.background }]}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={20}
                color={themeColors.textSecondary}
              />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Search projects..."
                placeholderTextColor={themeColors.textSecondary}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchProjects(text);
                }}
                autoFocus
              />
            </View>

            <ScrollView style={styles.projectList}>
              {loadingProjects ? (
                <ActivityIndicator size="large" color={themeColors.primary} style={styles.modalLoader} />
              ) : projects.length === 0 ? (
                <Text style={[styles.noResultsText, { color: themeColors.textSecondary }]}>
                  No projects found
                </Text>
              ) : (
                projects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={[styles.projectItem, { borderBottomColor: themeColors.border }]}
                    onPress={() => handleProjectSelect(project)}
                  >
                    <View style={[styles.projectIcon, { backgroundColor: themeColors.primary + '20' }]}>
                      <IconSymbol
                        ios_icon_name="building.2"
                        android_material_icon_name="business"
                        size={24}
                        color={themeColors.primary}
                      />
                    </View>
                    <View style={styles.projectInfo}>
                      <Text style={[styles.projectId, { color: themeColors.text }]}>
                        {project.external_id}
                      </Text>
                      <Text style={[styles.projectAddress, { color: themeColors.textSecondary }]}>
                        {project.address}, {project.city}
                      </Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={20}
                      color={themeColors.textSecondary}
                    />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Project Confirmation Modal */}
      <Modal
        visible={showConfirmation}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmContent, { backgroundColor: themeColors.card }, shadows.large]}>
            <View style={[styles.confirmIcon, { backgroundColor: themeColors.primary + '20' }]}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={48}
                color={themeColors.primary}
              />
            </View>
            <Text style={[styles.confirmTitle, { color: themeColors.text }]}>
              Confirm Project
            </Text>
            <Text style={[styles.confirmMessage, { color: themeColors.textSecondary }]}>
              Is this the correct project?
            </Text>
            {selectedProject && (
              <View style={[styles.confirmProjectCard, { backgroundColor: themeColors.background }]}>
                <Text style={[styles.confirmProjectId, { color: themeColors.text }]}>
                  {selectedProject.external_id}
                </Text>
                <Text style={[styles.confirmProjectAddress, { color: themeColors.textSecondary }]}>
                  {selectedProject.address}, {selectedProject.city}
                </Text>
              </View>
            )}
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonCancel, { backgroundColor: themeColors.background }]}
                onPress={() => setShowConfirmation(false)}
              >
                <Text style={[styles.confirmButtonText, { color: themeColors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonConfirm]}
                onPress={confirmProject}
              >
                <LinearGradient
                  colors={[themeColors.primary, themeColors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmButtonGradient}
                >
                  <Text style={styles.confirmButtonTextWhite}>
                    Confirm
                  </Text>
                </LinearGradient>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  headerButton: {
    padding: spacing.sm,
  },
  controlsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButtonWrapper: {
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
    minHeight: 64,
  },
  actionButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  contextSection: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  contextCard: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  contextIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextInfo: {
    flex: 1,
  },
  contextLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: 4,
  },
  contextValue: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  contextSubtext: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  previewSection: {
    marginBottom: spacing.lg,
  },
  previewCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  previewInfo: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTimestamp: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  uploadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981' + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  uploadedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B' + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  localText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  notesContainer: {
    padding: spacing.md,
    paddingTop: 0,
  },
  notesLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  saveNotesButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  saveNotesGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  saveNotesText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  recentSection: {
    marginBottom: spacing.lg,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    ...typography.body,
    fontWeight: '600',
  },
  recentScroll: {
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  recentItem: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  recentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recentBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: borderRadius.full,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentUploadedBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: borderRadius.full,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 250,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 15,
  },
  projectList: {
    flex: 1,
  },
  modalLoader: {
    marginTop: spacing.xl,
  },
  noResultsText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectInfo: {
    flex: 1,
  },
  projectId: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  projectAddress: {
    ...typography.bodySmall,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  confirmContent: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  confirmTitle: {
    ...typography.h2,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  confirmMessage: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  confirmProjectCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    width: '100%',
    marginBottom: spacing.lg,
  },
  confirmProjectId: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  confirmProjectAddress: {
    ...typography.bodySmall,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  confirmButtonCancel: {
    padding: spacing.md,
    alignItems: 'center',
  },
  confirmButtonConfirm: {
    // gradient inside
  },
  confirmButtonGradient: {
    padding: spacing.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  confirmButtonTextWhite: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
