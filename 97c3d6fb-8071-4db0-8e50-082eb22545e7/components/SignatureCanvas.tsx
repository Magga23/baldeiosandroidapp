
import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { useTheme } from '@react-navigation/native';

interface SignatureCanvasProps {
  onSignatureChange: (signature: string) => void;
  backgroundColor?: string;
  strokeColor?: string;
}

export default function SignatureCanvas({
  onSignatureChange,
  backgroundColor = '#FFFFFF',
  strokeColor = '#000000',
}: SignatureCanvasProps) {
  const theme = useTheme();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [paths, setPaths] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState<any[]>([]);

  const handleTouchStart = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setCurrentPath([{ x: locationX, y: locationY }]);
  };

  const handleTouchMove = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setCurrentPath([...currentPath, { x: locationX, y: locationY }]);
  };

  const handleTouchEnd = () => {
    if (currentPath.length > 0) {
      setPaths([...paths, currentPath]);
      setCurrentPath([]);
      
      // Generate base64 signature (simplified version)
      // In production, you'd use a proper canvas library like react-native-signature-canvas
      const signatureData = `data:image/png;base64,${btoa(JSON.stringify(paths))}`;
      onSignatureChange(signatureData);
    }
  };

  const clearSignature = () => {
    console.log('SignatureCanvas: Clearing signature');
    setPaths([]);
    setCurrentPath([]);
    onSignatureChange('');
  };

  return (
    <View style={styles.container}>
      <View
        style={[styles.canvas, { backgroundColor }]}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Text style={[styles.placeholder, { color: themeColors.textSecondary }]}>
          Sign here
        </Text>
        {/* In production, render the actual signature paths using SVG or Canvas */}
      </View>

      <TouchableOpacity
        style={[styles.clearButton, { backgroundColor: themeColors.card }]}
        onPress={clearSignature}
      >
        <IconSymbol
          ios_icon_name="trash"
          android_material_icon_name="delete"
          size={20}
          color={themeColors.error}
        />
        <Text style={[styles.clearButtonText, { color: themeColors.error }]}>
          Clear Signature
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  canvas: {
    height: 200,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  placeholder: {
    ...typography.body,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  clearButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
});
