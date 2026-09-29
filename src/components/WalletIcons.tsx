import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

export const PhantomIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 128 128">
    <Rect width="128" height="128" rx="28" fill="#AB9FF2" />
    <Path
      d="M101.4 69.8C98.9 50.9 83.1 36.6 63.8 36.6c-21.6 0-39.2 17.6-39.2 39.2 0 11.2 4.7 21.3 12.3 28.5 2.1 2 5.5 1.5 6.9-1.1l2.5-4.8c1.3-2.5 4.3-3.7 7-2.6 7.3 3 13.9 4.6 20.5 4.6 15.6 0 29.8-9.4 33.6-23.7.6-2.2 1.4-4.5 1.4-6.9H101.4z"
      fill="#FFFFFF"
    />
    <Circle cx="50" cy="62" r="5" fill="#4B447A" />
    <Circle cx="72" cy="62" r="5" fill="#4B447A" />
  </Svg>
);

export const SolflareIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 128 128">
    <Rect width="128" height="128" rx="28" fill="#1C1829" />
    <Path
      d="M64 24c4.8 14.4 14.4 24 28.8 28.8C78.4 57.6 68.8 67.2 64 81.6 59.2 67.2 49.6 57.6 35.2 52.8 49.6 48 59.2 38.4 64 24z"
      fill="#FC814A"
    />
    <Path
      d="M64 48c3.2 9.6 9.6 16 19.2 19.2C73.6 70.4 67.2 76.8 64 86.4 60.8 76.8 54.4 70.4 44.8 67.2 54.4 64 60.8 57.6 64 48z"
      fill="#FFD15C"
    />
    <Path
      d="M38 78c3 6 8 10 14 12-6 2-11 6-14 12-3-6-8-10-14-12 6-2 11-6 14-12z"
      fill="#FC814A"
    />
    <Path
      d="M90 78c3 6 8 10 14 12-6 2-11 6-14 12-3-6-8-10-14-12 6-2 11-6 14-12z"
      fill="#FC814A"
    />
  </Svg>
);

export const BackpackIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 128 128">
    <Rect width="128" height="128" rx="28" fill="#E33E38" />
    <Rect x="36" y="32" width="56" height="68" rx="14" fill="#FFFFFF" />
    <Rect x="46" y="24" width="36" height="16" rx="8" fill="#E33E38" />
    <Rect x="52" y="30" width="24" height="6" rx="3" fill="#FFFFFF" />
    <Rect x="44" y="60" width="40" height="28" rx="8" fill="#E33E38" />
    <Circle cx="64" cy="74" r="4" fill="#FFFFFF" />
  </Svg>
);

export const CoinbaseIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 128 128">
    <Rect width="128" height="128" rx="28" fill="#0052FF" />
    <Circle cx="64" cy="64" r="32" fill="#FFFFFF" />
    <Rect x="52" y="52" width="24" height="24" rx="4" fill="#0052FF" />
  </Svg>
);

export const SolanaLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 397 311" fill="none">
    <Path
      d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.7 0 8.6 6.9 4.6 10.9l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.7 0-8.6-6.9-4.6-10.9l62.7-62.7z"
      fill="#14F195"
    />
    <Path
      d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.7 0 8.6 6.9 4.6 10.9l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.7 0-8.6-6.9-4.6-10.9L64.6 3.8z"
      fill="#00F0FF"
    />
    <Path
      d="M333.3 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.7c-5.7 0-8.6 6.9-4.6 10.9l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.7 0 8.6-6.9 4.6-10.9l-62.7-62.7z"
      fill="#9945FF"
    />
  </Svg>
);
