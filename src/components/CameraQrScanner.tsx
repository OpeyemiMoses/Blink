import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Camera, X, RefreshCw, Upload, AlertCircle } from 'lucide-react-native';
import jsQR from 'jsqr';

interface CameraQrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export const CameraQrScanner: React.FC<CameraQrScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanning, setScanning] = useState(true);

  // File input ref for uploading QR photo fallback
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasPermission(false);
      setCameraError('Camera API (getUserMedia) is not supported in this browser environment.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        requestScan();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permissions in your browser.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No video camera was found on this device.');
      } else {
        setCameraError(err.message || 'Unable to access device camera.');
      }
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const requestScan = () => {
    if (!scanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          // Haptic feedback
          if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
            navigator.vibrate(100);
          }
          stopCamera();
          onScan(code.data);
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(requestScan);
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Decode uploaded image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            stopCamera();
            onScan(code.data);
          } else {
            setCameraError('No QR code detected in the selected image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <View style={styles.container}>
      {/* Scanner Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Camera size={18} color="#5B67F6" />
          <Text style={styles.title}>Scan Physical QR Code</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <X size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Camera Viewfinder View */}
      <View style={styles.viewfinderWrapper}>
        {/* Hidden Canvas for Decoding */}
        {Platform.OS === 'web' && (
          <canvas ref={canvasRef as any} style={{ display: 'none' }} />
        )}

        {/* Real Live HTML5 Video Element */}
        {Platform.OS === 'web' && (
          <video
            ref={videoRef as any}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              borderRadius: 16,
              backgroundColor: '#000000',
            }}
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Viewfinder Target Overlays */}
        {hasPermission && !cameraError && (
          <View style={styles.targetFrame} pointerEvents="none">
            {/* 4 Corners */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Scanning Line */}
            <View style={styles.scanLine} />
          </View>
        )}

        {/* Loading state while camera initializes */}
        {hasPermission === null && !cameraError && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#5B67F6" />
            <Text style={styles.loadingText}>Opening camera...</Text>
          </View>
        )}

        {/* Camera Error / Permission Denied UI */}
        {cameraError && (
          <View style={styles.errorOverlay}>
            <AlertCircle size={32} color="#EF4444" />
            <Text style={styles.errorTitle}>Camera Not Available</Text>
            <Text style={styles.errorSub}>{cameraError}</Text>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => startCamera(facingMode)}
            >
              <RefreshCw size={14} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Retry Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.instruction}>
        Point camera at any Physical Blink QR code or terminal display.
      </Text>

      {/* Control Bar: Flip Camera & Upload Photo */}
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={toggleFacingMode}
          activeOpacity={0.8}
        >
          <RefreshCw size={15} color="#5B67F6" />
          <Text style={styles.controlBtnText}>Flip Camera</Text>
        </TouchableOpacity>

        {Platform.OS === 'web' && (
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => fileInputRef.current?.click()}
            activeOpacity={0.8}
          >
            <Upload size={15} color="#5B67F6" />
            <Text style={styles.controlBtnText}>Scan from Photo</Text>
            <input
              type="file"
              ref={fileInputRef as any}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload as any}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#181B27',
    borderRadius: 8,
  },
  viewfinderWrapper: {
    width: '100%',
    height: 280,
    backgroundColor: '#07080B',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetFrame: {
    position: 'absolute',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#5B67F6',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  scanLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#5B67F6',
    shadowColor: '#5B67F6',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  loadingBox: {
    position: 'absolute',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#07080B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  errorSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#5B67F6',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  instruction: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 11,
    marginTop: 10,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 10,
    paddingVertical: 9,
  },
  controlBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
