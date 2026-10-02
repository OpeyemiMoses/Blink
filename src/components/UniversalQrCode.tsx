import React, { useState, useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import QRCode from 'qrcode';

interface UniversalQrCodeProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
  style?: ViewStyle;
}

export const UniversalQrCode: React.FC<UniversalQrCodeProps> = ({
  value,
  size = 180,
  bgColor = '#FFFFFF',
  fgColor = '#090A0F',
  style,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!value) {
      setDataUrl(null);
      return;
    }

    QRCode.toDataURL(
      value,
      {
        width: size * 2, // 2x density for retina crispness
        margin: 1,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      },
      (err, url) => {
        if (!err && isMounted && url) {
          setDataUrl(url);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [value, size, bgColor, fgColor]);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      {dataUrl ? (
        <Image
          source={{ uri: dataUrl }}
          style={{ width: size, height: size, borderRadius: 8 }}
          resizeMode="contain"
        />
      ) : (
        <ActivityIndicator size="small" color="#5B67F6" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
});
