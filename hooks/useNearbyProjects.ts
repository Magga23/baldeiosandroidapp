
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ProjectWithCoords {
  id: string;
  external_id: string;
  address: string;
  zipcode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

export interface NearbyProject extends ProjectWithCoords {
  distance: number; // meters from user
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}

// Haversine formula to calculate distance between two coordinates
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

export const useNearbyProjects = () => {
  const [nearbyProjects, setNearbyProjects] = useState<NearbyProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findNearbyProjects = async (
    userLat: number,
    userLon: number,
    radiusMeters: number = 500
  ): Promise<NearbyProject[]> => {
    console.log('useNearbyProjects: Finding projects within', radiusMeters, 'meters of', userLat, userLon);
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all projects with coordinates from Supabase
      const { data: projects, error: fetchError } = await supabase
        .from('projects')
        .select('id, external_id, address, zipcode, city, plz, stadt, latitude, longitude, status')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (fetchError) {
        console.error('useNearbyProjects: Error fetching projects', fetchError);
        setError(fetchError.message);
        setIsLoading(false);
        return [];
      }

      if (!projects || projects.length === 0) {
        console.log('useNearbyProjects: No projects with coordinates found');
        setIsLoading(false);
        return [];
      }

      console.log('useNearbyProjects: Found', projects.length, 'projects with coordinates');

      // Calculate distance for each project and filter by radius
      const projectsWithDistance: NearbyProject[] = projects
        .map((project) => {
          const distance = calculateDistance(
            userLat,
            userLon,
            project.latitude!,
            project.longitude!
          );

          return {
            id: project.id,
            external_id: project.external_id,
            address: project.address || '',
            zipcode: project.zipcode || project.plz || '',
            city: project.city || project.stadt || '',
            latitude: project.latitude,
            longitude: project.longitude,
            status: project.status,
            distance,
          };
        })
        .filter((project) => project.distance <= radiusMeters)
        .sort((a, b) => a.distance - b.distance);

      console.log('useNearbyProjects: Found', projectsWithDistance.length, 'projects within radius');
      setNearbyProjects(projectsWithDistance);
      setIsLoading(false);
      return projectsWithDistance;
    } catch (err) {
      console.error('useNearbyProjects: Error finding nearby projects', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
      return [];
    }
  };

  return {
    nearbyProjects,
    isLoading,
    error,
    findNearbyProjects,
  };
};
