import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { supabase } from './lib/supabase';
import MonumentModal from '../components/MonumentModal';
import { styles } from './camera-styles';

interface Monument {
  name: string;
  description: string;
  audio_url?: string;
  narrator_avatar?: string;
}

export default function Camera() {
  const router = useRouter();
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [monument, setMonument] = useState<Monument | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      setIsLoading(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
        });

        if (photo?.base64) {
          const { data, error } = await supabase.functions.invoke('google-lens-identify', {
            body: { imageData: photo.base64 },
          });

          if (error) throw error;

          if (data?.success && data?.monument) {
            setMonument(data.monument);
            setModalVisible(true);
          } else {
            Alert.alert('No Monument Found', 'Could not identify any monument in this image.');
          }
        }
      } catch (error) {
        console.error('Error identifying monument:', error);
        // Show a more specific error message for network issues
        const errorMessage = error instanceof Error && error.message.includes('fetch') 
          ? 'Network connection error. Please check your internet connection and try again.'
          : 'Failed to identify monument. Please try again.';
        Alert.alert('Error', errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setMonument(null);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>‹</Text>
      </TouchableOpacity>
      
      <CameraView 
        style={styles.camera} 
        facing={facing}
        ref={cameraRef}
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.captureButton} 
            onPress={takePicture}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Identifying...' : "What's this?"}
            </Text>
          </TouchableOpacity>
        </View>
      </CameraView>

      <MonumentModal 
        visible={modalVisible}
        monument={monument}
        onClose={closeModal}
      />
    </View>
  );
}
