import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';

interface PrivyIconProps {
  size?: number;
  style?: ViewStyle;
}

export const PrivyIcon: React.FC<PrivyIconProps> = ({ size = 18, style }) => {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Image
        source={{
          uri: 'https://framerusercontent.com/images/oPqxoNxeHrQ9qgbjTUGuANdXdQ.png',
        }}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="contain"
      />
    </View>
  );
};
