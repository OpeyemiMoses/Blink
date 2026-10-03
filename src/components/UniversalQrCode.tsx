import React, { useState, useEffect, createElement } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, ViewStyle, Platform } from 'react-native';
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
  size = 220,
  bgColor = '#FFFFFF',
  fgColor = '#090A0F',
  style,
}) => {
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!value) {
      setSvgHtml(null);
      setDataUrl(null);
      return;
    }

    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value)}&bgcolor=${bgColor.replace('#', '')}&color=${fgColor.replace('#', '')}`;

    // 1. Direct SVG Generation (Instant Vector)
    try {
      QRCode.toString(value, {
        type: 'svg',
        margin: 1,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      })
        .then((svg) => {
          if (isMounted && svg) {
            const styledSvg = svg.replace(
              /<svg\b/i,
              '<svg width="100%" height="100%" style="width:100%;height:100%;display:block;border-radius:8px;" '
            );
            setSvgHtml(styledSvg);
          }
        })
        .catch(() => {});
    } catch {}

    // 2. Direct Canvas / PNG Data URL
    try {
      QRCode.toDataURL(value, {
        width: size * 2,
        margin: 1,
        color: { dark: fgColor, light: bgColor },
      })
        .then((url) => {
          if (isMounted && url) setDataUrl(url);
        })
        .catch(() => {
          if (isMounted) setDataUrl(fallbackUrl);
        });
    } catch {
      if (isMounted) setDataUrl(fallbackUrl);
    }

    // 3. Fallback safety timer
    const timer = setTimeout(() => {
      if (isMounted) {
        setDataUrl((prev) => prev || fallbackUrl);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [value, size, bgColor, fgColor]);

  // In Web / DOM runtime (Capacitor Android WebView and Desktop/Mobile Chrome)
  if (Platform.OS === 'web' && svgHtml) {
    return createElement('div', {
      style: {
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        overflow: 'hidden',
      },
      dangerouslySetInnerHTML: { __html: svgHtml },
    });
  }

  const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value || 'solana')}&bgcolor=${bgColor.replace('#', '')}&color=${fgColor.replace('#', '')}`;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor: bgColor,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 8,
          overflow: 'hidden',
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
        <Image
          source={{ uri: fallbackUrl }}
          style={{ width: size, height: size, borderRadius: 8 }}
          resizeMode="contain"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
