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

const solanaLogoUser = require('../../assets/branding/solana_logo_user.jpg');
const usdcLogoUser = require('../../assets/branding/usdc_logo_user.jpg');
const skrLogoUser = require('../../assets/branding/skr_logo_user.jpg');

export const SolanaCoinLogo: React.FC<{ size?: number }> = ({ size = 36 }) => {
  if (Platform.OS === 'web') {
    const srcUri = typeof solanaLogoUser === 'object' && solanaLogoUser !== null ? ((solanaLogoUser as any).uri || solanaLogoUser) : solanaLogoUser;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }}>
        {React.createElement('img', {
          src: String(srcUri),
          width: size,
          height: size,
          alt: 'Solana Logo',
          style: { width: size, height: size, objectFit: 'cover', borderRadius: size / 2, display: 'block' },
        })}
      </View>
    );
  }
  return (
    <Image
      source={solanaLogoUser}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
};

export const UsdcCoinLogo: React.FC<{ size?: number }> = ({ size = 36 }) => {
  if (Platform.OS === 'web') {
    const srcUri = typeof usdcLogoUser === 'object' && usdcLogoUser !== null ? ((usdcLogoUser as any).uri || usdcLogoUser) : usdcLogoUser;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#2775CA', alignItems: 'center', justifyContent: 'center' }}>
        {React.createElement('img', {
          src: String(srcUri),
          width: size,
          height: size,
          alt: 'USDC Logo',
          style: { width: size, height: size, objectFit: 'cover', borderRadius: size / 2, display: 'block' },
        })}
      </View>
    );
  }
  return (
    <Image
      source={usdcLogoUser}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
};

export const SkrCoinLogo: React.FC<{ size?: number }> = ({ size = 36 }) => {
  if (Platform.OS === 'web') {
    const srcUri = typeof skrLogoUser === 'object' && skrLogoUser !== null ? ((skrLogoUser as any).uri || skrLogoUser) : skrLogoUser;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }}>
        {React.createElement('img', {
          src: String(srcUri),
          width: size,
          height: size,
          alt: 'SKR Logo',
          style: { width: size, height: size, objectFit: 'cover', borderRadius: size / 2, display: 'block' },
        })}
      </View>
    );
  }
  return (
    <Image
      source={skrLogoUser}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
};
