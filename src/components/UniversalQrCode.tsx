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

    try {
      QRCode.toString(value, {
        type: 'svg',
        margin: 1,
        width: size,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      })
        .then((svg) => {
          if (isMounted && svg) {
            const styledSvg = svg.replace(
              /<svg\b([^>]*)>/i,
              `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" $1 style="width:${size}px;height:${size}px;display:block;border-radius:8px;">`
            );
            setSvgHtml(styledSvg);
            try {
              const b64 =
                typeof window !== 'undefined' && window.btoa
                  ? window.btoa(unescape(encodeURIComponent(svg)))
                  : '';
              if (b64) setDataUrl(`data:image/svg+xml;base64,${b64}`);
            } catch {}
          }
        })
        .catch(() => {
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
        });
    } catch {
      if (isMounted) setDataUrl(fallbackUrl);
    }

    const timer = setTimeout(() => {
      if (isMounted) {
        setDataUrl((prev) => prev || fallbackUrl);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
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
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 8,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {svgHtml ? (
        <View
          style={{ width: size, height: size }}
          {...({ dangerouslySetInnerHTML: { __html: svgHtml } } as any)}
        />
      ) : dataUrl ? (
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
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
