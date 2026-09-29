import React from 'react';
import { View, Image, ViewStyle, ImageStyle } from 'react-native';
import {
  GOOGLE_LOGO_URI,
  TELEGRAM_LOGO_URI,
  DISCORD_LOGO_URI,
  GITHUB_LOGO_URI,
  X_LOGO_URI,
  EMAIL_LOGO_URI,
} from '../constants/socialLogosBase64';

export interface LogoProps {
  size?: number;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
}

/** Official Google Multi-color Logo Image */
export const GoogleLogo: React.FC<LogoProps> = ({ size = 20, style, imageStyle }) => (
  <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
    <Image
      source={{ uri: GOOGLE_LOGO_URI }}
      style={[{ width: size, height: size }, imageStyle]}
      resizeMode="contain"
    />
  </View>
);

/** Official Telegram Round Logo Image */
export const TelegramLogo: React.FC<LogoProps> = ({ size = 20, style, imageStyle }) => (
  <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
    <Image
      source={{ uri: TELEGRAM_LOGO_URI }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, imageStyle]}
      resizeMode="contain"
    />
  </View>
);

/** Official X Logo Image */
export const XLogo: React.FC<LogoProps> = ({ size = 20, style, imageStyle }) => (
  <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
    <Image
      source={{ uri: X_LOGO_URI }}
      style={[{ width: size, height: size }, imageStyle]}
      resizeMode="contain"
    />
  </View>
);

/** Official Discord Clyde Logo Image */
export const DiscordLogo: React.FC<LogoProps> = ({ size = 20, style, imageStyle }) => (
  <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
    <Image
      source={{ uri: DISCORD_LOGO_URI }}
      style={[{ width: size, height: size }, imageStyle]}
      resizeMode="contain"
    />
  </View>
);

/** Official GitHub Octocat Badge Logo Image */
export const GithubLogo: React.FC<LogoProps> = ({ size = 20, style, imageStyle }) => (
  <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
    <Image
      source={{ uri: GITHUB_LOGO_URI }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, imageStyle]}
      resizeMode="contain"
    />
  </View>
);

/** Official Styled Gmail / Email Logo Image */
export const EmailLogo: React.FC<LogoProps> = ({ size = 20, style, imageStyle }) => (
  <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
    <Image
      source={{ uri: EMAIL_LOGO_URI }}
      style={[{ width: size, height: size }, imageStyle]}
      resizeMode="contain"
    />
  </View>
);
