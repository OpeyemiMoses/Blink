import React from 'react';
import { Image, View, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '../theme/ThemeContext';

const logoCroppedWhite = require('../../assets/branding/logo_cropped_white.png');
const logoCroppedBlack = require('../../assets/branding/logo_cropped_black.png');
const logoSquareWhite = require('../../assets/branding/logo_square_white.png');
const logoSquareBlack = require('../../assets/branding/logo_square_black.png');

export const BlinkLogo: React.FC<{ size?: number; variant?: 'white' | 'black'; square?: boolean }> = ({
  size = 36,
  variant,
  square = false,
}) => {
  const { isDark } = useTheme();
  const effectiveVariant = variant || (isDark ? 'white' : 'black');
  const isBlack = effectiveVariant === 'black';
  const source = square
    ? (isBlack ? logoSquareBlack : logoSquareWhite)
    : (isBlack ? logoCroppedBlack : logoCroppedWhite);

  const width = square ? size : Math.round(size * (273 / 365));

  if (Platform.OS === 'web') {
    const srcUri = typeof source === 'object' && source !== null ? ((source as any).uri || source) : source;
    return (
      <View
        key={`blink-logo-${effectiveVariant}-${square}`}
        style={{
          width,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        {React.createElement('img', {
          src: String(srcUri),
          width,
          height: size,
          alt: 'Blink Logo',
          style: {
            width,
            height: size,
            objectFit: 'contain',
            display: 'block',
            filter: isBlack ? 'brightness(0)' : 'none',
          },
        })}
      </View>
    );
  }

  return (
    <Image
      key={`blink-logo-${effectiveVariant}-${square}`}
      source={source}
      style={{
        width,
        height: size,
      }}
      tintColor={isBlack ? '#090A0F' : undefined}
      resizeMode="contain"
    />
  );
};

export const JustBlinkLogo = BlinkLogo;

export const BlinkBrandMark: React.FC<{ size?: number; variant?: 'white' | 'black' }> = ({
  size = 32,
  variant,
}) => {
  const { isDark } = useTheme();
  const effectiveVariant = variant || (isDark ? 'white' : 'black');
  const isBlack = effectiveVariant === 'black';
  const height = size;
  const width = Math.round(size * (273 / 365));

  if (Platform.OS === 'web') {
    const source = isBlack ? logoCroppedBlack : logoCroppedWhite;
    const srcUri = typeof source === 'object' && source !== null ? ((source as any).uri || source) : source;
    return (
      <View
        key={`brandmark-wrap-${effectiveVariant}`}
        style={{
          width,
          height,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        {React.createElement('img', {
          src: String(srcUri),
          width,
          height,
          alt: 'Blink Brandmark',
          style: {
            width,
            height,
            objectFit: 'contain',
            display: 'block',
            filter: isBlack ? 'brightness(0)' : 'none',
          },
        })}
      </View>
    );
  }

  return (
    <View
      key={`brandmark-wrap-${effectiveVariant}`}
      style={{
        width,
        height,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <Image
        key={`brandmark-img-${effectiveVariant}`}
        source={isBlack ? logoCroppedBlack : logoCroppedWhite}
        style={{
          width,
          height,
        }}
        tintColor={isBlack ? '#090A0F' : undefined}
        resizeMode="contain"
      />
    </View>
  );
};

export const CoffeeShopLogo: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <Defs>
      <LinearGradient id="coffeeGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <Stop offset="0%" stopColor="#F59E0B" />
        <Stop offset="100%" stopColor="#D97706" />
      </LinearGradient>
    </Defs>
    <Circle cx="22" cy="22" r="21" fill="#161822" stroke="#262A38" strokeWidth="1" />
    <Circle cx="22" cy="22" r="15" fill="rgba(245, 158, 11, 0.12)" />
    {/* Coffee Cup */}
    <Path
      d="M15 18H27V25C27 27.2091 25.2091 29 23 29H19C16.7909 29 15 27.2091 15 25V18Z"
      stroke="url(#coffeeGrad)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M27 20H29C30.1046 20 31 20.8954 31 22C31 23.1046 30.1046 24 29 24H27"
      stroke="url(#coffeeGrad)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <Path
      d="M18 14V16M22 13V16M26 14V16"
      stroke="url(#coffeeGrad)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </Svg>
);

export const MusicianLogo: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <Defs>
      <LinearGradient id="musicGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <Stop offset="0%" stopColor="#EC4899" />
        <Stop offset="100%" stopColor="#8B5CF6" />
      </LinearGradient>
    </Defs>
    <Circle cx="22" cy="22" r="21" fill="#161822" stroke="#262A38" strokeWidth="1" />
    <Circle cx="22" cy="22" r="15" fill="rgba(236, 72, 153, 0.12)" />
    {/* Music Note / Soundwave */}
    <Path
      d="M18 27V17L28 14V24"
      stroke="url(#musicGrad)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="16" cy="27" r="2.5" fill="#EC4899" />
    <Circle cx="26" cy="24" r="2.5" fill="#8B5CF6" />
  </Svg>
);

export const HackerHouseLogo: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <Defs>
      <LinearGradient id="solGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <Stop offset="0%" stopColor="#00FFA3" />
        <Stop offset="100%" stopColor="#DC1FFF" />
      </LinearGradient>
    </Defs>
    <Circle cx="22" cy="22" r="21" fill="#161822" stroke="#262A38" strokeWidth="1" />
    <Circle cx="22" cy="22" r="15" fill="rgba(0, 255, 163, 0.1)" />
    {/* Solana 3-bar mark */}
    <Path
      d="M16 28L28 28M17.5 22L29.5 22M16 16L28 16"
      stroke="url(#solGrad)"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </Svg>
);

export const UsdcCoinLogo: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    {/* Blue circular coin base */}
    <Circle cx="50" cy="50" r="48" fill="#2775CA" />
    {/* White inner coin face */}
    <Circle cx="50" cy="50" r="38" fill="#FFFFFF" />
    {/* Left blue arc */}
    <Path
      d="M 44 26 C 30 30 30 70 44 74 C 36 68 36 32 44 26 Z"
      fill="#2775CA"
    />
    {/* Right blue arc */}
    <Path
      d="M 56 26 C 70 30 70 70 56 74 C 64 68 64 32 56 26 Z"
      fill="#2775CA"
    />
    {/* Center blue $ dollar symbol */}
    <Path
      d="M 50 20 V 80 M 38 35 C 38 26 62 26 62 38 C 62 50 38 48 38 62 C 38 74 62 74 62 65"
      stroke="#2775CA"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

export const SolanaCoinLogo: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <Defs>
      <LinearGradient id="solOfficialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#00FFA3" />
        <Stop offset="50%" stopColor="#00C2FF" />
        <Stop offset="100%" stopColor="#9945FF" />
      </LinearGradient>
    </Defs>
    <Circle cx="50" cy="50" r="48" fill="#090A0F" stroke="#252A38" strokeWidth="2" />
    {/* Top Bar */}
    <Path
      d="M 24 20 L 78 20 C 80.5 20 81.8 21.2 80.6 23.4 L 69.4 37.6 C 68.6 38.6 67.2 39.2 65.8 39.2 L 10 39.2 C 7.5 39.2 6.2 38 7.4 35.8 L 18.6 21.6 C 19.4 20.6 20.8 20 22.2 20 Z"
      fill="url(#solOfficialGrad)"
    />
    {/* Middle Bar (Inverted Slant) */}
    <Path
      d="M 10 42.4 C 7.5 42.4 6.2 43.6 7.4 45.8 L 18.6 60 C 19.4 61 20.8 61.6 22.2 61.6 L 78 61.6 C 80.5 61.6 81.8 60.4 80.6 58.2 L 69.4 44 C 68.6 43 67.2 42.4 65.8 42.4 Z"
      fill="url(#solOfficialGrad)"
    />
    {/* Bottom Bar */}
    <Path
      d="M 24 64.8 L 78 64.8 C 80.5 64.8 81.8 66 80.6 68.2 L 69.4 82.4 C 68.6 83.4 67.2 84 65.8 84 L 10 84 C 7.5 84 6.2 82.8 7.4 80.6 L 18.6 66.4 C 19.4 65.4 20.8 64.8 22.2 64.8 Z"
      fill="url(#solOfficialGrad)"
    />
  </Svg>
);

export const SkrCoinLogo: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <Circle cx="50" cy="50" r="48" fill="#090A0F" stroke="#252A38" strokeWidth="2" />
    {/* Upper piece of white interlocking 'S' logo */}
    <Path
      d="M 74 16 L 46 16 A 22 22 0 0 0 24 38 L 24 40 A 22 22 0 0 0 46 62 L 74 62 L 74 48 L 46 48 A 8 8 0 0 1 38 40 L 38 38 A 8 8 0 0 1 46 30 L 74 30 Z"
      fill="#FFFFFF"
    />
    {/* Lower piece of white interlocking 'S' logo (180deg rotational symmetry) */}
    <Path
      d="M 26 84 L 54 84 A 22 22 0 0 0 76 62 L 76 60 A 22 22 0 0 0 54 38 L 26 38 L 26 52 L 54 52 A 8 8 0 0 1 62 60 L 62 62 A 8 8 0 0 1 54 70 L 26 70 Z"
      fill="#FFFFFF"
    />
  </Svg>
);
