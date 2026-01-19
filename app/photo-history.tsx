
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';

interface Photo {
  id: string;
  projectId: string;
  projectAddress?: string;
  employeeId?: string;
  employeeName?: string;
  photoUrl: string;
  notes?: string;
  createdAt: string;
}

export default function PhotoHistoryScreen() {
  const theme = useTheme();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;
  const { user } = useAuth();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    console.log('PhotoHistoryScreen: Component mounted');
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    console.log('PhotoHistoryScreen: Fetching photos from backend');
    try {
      setLoading(true);
      
      // TODO: Backend Integration - GET /api/photos
      // Returns: [{ id, projectId, projectAddress, employeeId, employeeName, photoUrl, notes, createdAt }]
      
      // Mock data for now
      const mockPhotos: Photo[] = [];
      setPhotos(mockPhotos);
      
      console.log('PhotoHistoryScreen: Photos loaded:', mockPhotos.length);
    } catch (error) {
      console.error('PhotoHistoryScreen: Error fetching photos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('PhotoHistoryScreen: User pulled to refresh');
    setRefreshing(true);
    fetchPhotos();
  };

  const handlePhotoPress = (photo: Photo) => {
    console.log('PhotoHistoryScreen: User tapped photo:', photo.id);
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
  };

  const deletePhoto = async (photoId: string) => {
    console.log('PhotoHistoryScreen: Deleting photo:', photoId);
    
    // TODO: Backend Integration - DELETE /api/photos/:id
    
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    setShowPhotoModal(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredPhotos = photos.filter(photo => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      photo.projectId.toLowerCase().includes(query) ||
      photo.projectAddress?.toLowerCase().includes(query) ||
      photo.employeeName?.toLowerCase().includes(query) ||
      photo.notes?.toLowerCase().includes(query)
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Photo History',
          headerStyle: {
            backgroundColor: themeColors.card,
          },
          headerTintColor: themeColors.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('PhotoHistoryScreen: User tapped back button');
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
        }}
      />

      <ScrollView
        style={styles.scrollView}
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
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <LinearGradient
            colors={[themeColors.primary, themeColors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <IconSymbol
              ios_icon_name="photo.stack"
              android_material_icon_name="photo-library"
              size={48}
              color="#FFFFFF"
            />
            <Text style={styles.headerTitle}>Photo History</Text>
            <Text style={styles.headerSubtitle}>
              {photos.length} {photos.length === 1 ? 'photo' : 'photos'} captured
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <View style={[styles.searchBar, { backgroundColor: themeColors.card }]}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={20}
              color={themeColors.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search by project, employee, or notes..."
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

        {/* Photos Grid */}
        {loading && photos.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Loading photos...
            </Text>
          </View>
        ) : filteredPhotos.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.emptyState}>
            <LinearGradient
              colors={[themeColors.primary + '20', themeColors.primary + '10']}
              style={styles.emptyIconContainer}
            >
              <IconSymbol
                ios_icon_name="photo.stack"
                android_material_icon_name="photo-library"
                size={64}
                color={themeColors.primary}
              />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              {searchQuery ? 'No photos found' : 'No photos yet'}
            </Text>
            <Text style={[styles.emptyDescription, { color: themeColors.textSecondary }]}>
              {searchQuery
                ? 'Try a different search term'
                : 'Start documenting your projects by taking photos'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/camera')}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyButtonGradient}
                >
                  <IconSymbol
                    ios_icon_name="camera.fill"
                    android_material_icon_name="camera"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.emptyButtonText}>Take Photo</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        ) : (
          <View style={styles.photosGrid}>
            {filteredPhotos.map((photo, index) => (
              <Animated.View
                key={photo.id}
                entering={FadeInDown.delay(index * 50).duration(400)}
                style={styles.photoCardWrapper}
              >
                <TouchableOpacity
                  style={[styles.photoCard, { backgroundColor: themeColors.card }, shadows.medium]}
                  onPress={() => handlePhotoPress(photo)}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: photo.photoUrl }} style={styles.photoImage} />
                  
                  <View style={styles.photoOverlay}>
                    <LinearGradient
                      colors={['transparent', 'rgba(0, 0, 0, 0.8)']}
                      style={styles.photoGradient}
                    >
                      <View style={styles.photoInfo}>
                        <View style={styles.photoMetaRow}>
                          <IconSymbol
                            ios_icon_name="building.2"
                            android_material_icon_name="business"
                            size={14}
                            color="#FFFFFF"
                          />
                          <Text style={styles.photoProjectId} numberOfLines={1}>
                            {photo.projectId}
                          </Text>
                        </View>
                        {photo.employeeName && (
                          <View style={styles.photoMetaRow}>
                            <IconSymbol
                              ios_icon_name="person.fill"
                              android_material_icon_name="person"
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.photoEmployeeName} numberOfLines={1}>
                              {photo.employeeName}
                            </Text>
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  </View>

                  {photo.notes && (
                    <View style={styles.notesBadge}>
                      <IconSymbol
                        ios_icon_name="note.text"
                        android_material_icon_name="description"
                        size={14}
                        color="#FFFFFF"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Photo Detail Modal */}
      <Modal
        visible={showPhotoModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPhotoModal(false)}
            >
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={32}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {selectedPhoto && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image
                  source={{ uri: selectedPhoto.photoUrl }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />

                <View style={styles.modalDetails}>
                  <View style={[styles.modalDetailCard, { backgroundColor: themeColors.background }]}>
                    <View style={styles.modalDetailRow}>
                      <IconSymbol
                        ios_icon_name="building.2"
                        android_material_icon_name="business"
                        size={20}
                        color={themeColors.primary}
                      />
                      <View style={styles.modalDetailInfo}>
                        <Text style={[styles.modalDetailLabel, { color: themeColors.textSecondary }]}>
                          Project
                        </Text>
                        <Text style={[styles.modalDetailValue, { color: themeColors.text }]}>
                          {selectedPhoto.projectId}
                        </Text>
                        {selectedPhoto.projectAddress && (
                          <Text style={[styles.modalDetailSubtext, { color: themeColors.textSecondary }]}>
                            {selectedPhoto.projectAddress}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {selectedPhoto.employeeName && (
                    <View style={[styles.modalDetailCard, { backgroundColor: themeColors.background }]}>
                      <View style={styles.modalDetailRow}>
                        <IconSymbol
                          ios_icon_name="person.fill"
                          android_material_icon_name="person"
                          size={20}
                          color="#10B981"
                        />
                        <View style={styles.modalDetailInfo}>
                          <Text style={[styles.modalDetailLabel, { color: themeColors.textSecondary }]}>
                            Taken by
                          </Text>
                          <Text style={[styles.modalDetailValue, { color: themeColors.text }]}>
                            {selectedPhoto.employeeName}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  <View style={[styles.modalDetailCard, { backgroundColor: themeColors.background }]}>
                    <View style={styles.modalDetailRow}>
                      <IconSymbol
                        ios_icon_name="calendar"
                        android_material_icon_name="calendar-today"
                        size={20}
                        color={themeColors.textSecondary}
                      />
                      <View style={styles.modalDetailInfo}>
                        <Text style={[styles.modalDetailLabel, { color: themeColors.textSecondary }]}>
                          Date
                        </Text>
                        <Text style={[styles.modalDetailValue, { color: themeColors.text }]}>
                          {formatDate(selectedPhoto.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {selectedPhoto.notes && (
                    <View style={[styles.modalDetailCard, { backgroundColor: themeColors.background }]}>
                      <View style={styles.modalDetailRow}>
                        <IconSymbol
                          ios_icon_name="note.text"
                          android_material_icon_name="description"
                          size={20}
                          color={themeColors.textSecondary}
                        />
                        <View style={styles.modalDetailInfo}>
                          <Text style={[styles.modalDetailLabel, { color: themeColors.textSecondary }]}>
                            Notes
                          </Text>
                          <Text style={[styles.modalDetailValue, { color: themeColors.text }]}>
                            {selectedPhoto.notes}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                      deletePhoto(selectedPhoto.id);
                    }}
                  >
                    <View style={styles.deleteButtonInner}>
                      <IconSymbol
                        ios_icon_name="trash.fill"
                        android_material_icon_name="delete"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={styles.deleteButtonText}>Delete Photo</Text>
                    </View>
                  </TouchableOpacity>
                </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerButton: {
    padding: spacing.sm,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerGradient: {
    padding: spacing.xl,
    alignItems: 'center',
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing.md,
  },
  headerTitle: {
    ...typography.h1,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...shadows.medium,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
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
    ...typography.h2,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 300,
  },
  emptyButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  photoCardWrapper: {
    width: '48%',
  },
  photoCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    aspectRatio: 1,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  photoGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.sm,
  },
  photoInfo: {
    gap: 4,
  },
  photoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoProjectId: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
    flex: 1,
  },
  photoEmployeeName: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    flex: 1,
  },
  notesBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: '#10B981',
    borderRadius: borderRadius.full,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
    zIndex: 10,
  },
  modalImage: {
    width: '100%',
    height: 400,
    borderRadius: borderRadius.xl,
    marginTop: 80,
    marginBottom: spacing.lg,
  },
  modalDetails: {
    gap: spacing.md,
  },
  modalDetailCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  modalDetailInfo: {
    flex: 1,
  },
  modalDetailLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalDetailValue: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  modalDetailSubtext: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  deleteButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  deleteButtonInner: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  deleteButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
