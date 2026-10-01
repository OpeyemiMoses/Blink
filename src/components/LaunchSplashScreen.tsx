import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
  Platform,
  Easing,
} from 'react-native';
import Svg, { Rect, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { BlinkBrandMark } from './BrandLogos';

interface LaunchSplashScreenProps {
  onFinish: () => void;
  durationMs?: number;
}

// Pixel block definition for disassociation effect
const PIXEL_GRID = [
  // Angular upper arm of Blink logo
  { id: 1, x: -36, y: -48, ox: -80, oy: -90, color: '#5B67F6' },
  { id: 2, x: -20, y: -48, ox: -40, oy: -110, color: '#6366F1' },
  { id: 3, x: -4,  y: -48, ox: 10,  oy: -95, color: '#4F46E5' },
  { id: 4, x: -36, y: -32, ox: -110, oy: -40, color: '#818CF8' },
  { id: 5, x: -20, y: -32, ox: -60, oy: -50, color: '#6366F1' },
  { id: 6, x: -4,  y: -32, ox: 30,  oy: -60, color: '#4F46E5' },
  { id: 7, x: 12,  y: -32, ox: 80,  oy: -70, color: '#10B981' },

  // Center lightning slant
  { id: 8,  x: -20, y: -16, ox: -70, oy: 10,  color: '#818CF8' },
  { id: 9,  x: -4,  y: -16, ox: -20, oy: -20, color: '#5B67F6' },
  { id: 10, x: 12,  y: -16, ox: 60,  oy: -15, color: '#10B981' },
  { id: 11, x: 28,  y: -16, ox: 100, oy: -30, color: '#34D399' },
  { id: 12, x: -4,  y: 0,   ox: -10, oy: 15,  color: '#6366F1' },
  { id: 13, x: 12,  y: 0,   ox: 40,  oy: 30,  color: '#10B981' },
  { id: 14, x: 28,  y: 0,   ox: 90,  oy: 20,  color: '#14F195' },

  // Lower return slant
  { id: 15, x: -20, y: 16,  ox: -90, oy: 50,  color: '#4F46E5' },
  { id: 16, x: -4,  y: 16,  ox: -30, oy: 60,  color: '#6366F1' },
  { id: 17, x: 12,  y: 16,  ox: 30,  oy: 75,  color: '#10B981' },
  { id: 18, x: -20, y: 32,  ox: -80, oy: 100, color: '#4338CA' },
  { id: 19, x: -4,  y: 32,  ox: -10, oy: 110, color: '#4F46E5' },
  { id: 20, x: -36, y: 48,  ox: -95, oy: 125, color: '#3730A3' },
  { id: 21, x: -20, y: 48,  ox: -50, oy: 135, color: '#4338CA' },
];

export const LaunchSplashScreen: React.FC<LaunchSplashScreenProps> = ({
  onFinish,
  durationMs = 3000,
}) => {
  const { colors, isDark } = useTheme();

  // Master fade out for the entire splash dissolving after 3 seconds
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Pixel disassociation loop: 0 = unified logo, 1 = exploded in pixels
  const disassociationAnim = useRef(new Animated.Value(0)).current;

  // Continuous rotation & scale breathing for central core
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Linear loading progress bar from 0 to 1 over durationMs
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Loop pixel disassociating and coalescing back together
    const disassociateLoop = Animated.loop(
      Animated.sequence([
        // Stay solid
        Animated.delay(350),
        // Explode into pixels
        Animated.timing(disassociationAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        // Float in pixel space
        Animated.delay(200),
        // Magnetic snap back together
        Animated.timing(disassociationAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        // Rest unified
        Animated.delay(400),
      ])
    );
    disassociateLoop.start();

    // 2. Subtle logo pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 3. Bottom progress line fill
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: durationMs - 500,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // 4. Dissolve screen after 3 seconds
    const dissolveTimer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        disassociateLoop.stop();
        pulseLoop.stop();
        onFinish();
      });
    }, durationMs - 500);

    return () => {
      clearTimeout(dissolveTimer);
      disassociateLoop.stop();
      pulseLoop.stop();
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.fullScreenOverlay,
        {
          backgroundColor: isDark ? '#07080B' : '#F0F2F8',
          opacity: screenOpacity,
        },
      ]}
      pointerEvents="auto"
    >
      {/* ─── CENTER: PIXEL DISASSOCIATING & COALESCING LOGO ────────────────────── */}
      <View style={styles.centerContainer}>
        {/* Core Animated Brand Logo Container */}
        <Animated.View
          style={[
            styles.pixelCanvas,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          {/* Base Solid Logo that fades slightly as pixels explode */}
          <Animated.View
            style={[
              styles.solidLogoWrap,
              {
                opacity: disassociationAnim.interpolate({
                  inputRange: [0, 0.35, 1],
                  outputRange: [1, 0.15, 0],
                }),
              },
            ]}
          >
            <BlinkBrandMark size={110} variant={isDark ? 'white' : 'black'} />
          </Animated.View>

          {/* Dissociating Pixels Matrix */}
          {PIXEL_GRID.map((px) => {
            const translateX = disassociationAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [px.x, px.ox],
            });
            const translateY = disassociationAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [px.y, px.oy],
            });
            const rotate = disassociationAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${(px.id % 2 === 0 ? 1 : -1) * 75}deg`],
            });
            const pixelOpacity = disassociationAnim.interpolate({
              inputRange: [0, 0.15, 0.85, 1],
              outputRange: [0, 0.95, 0.95, 0.75],
            });
            const scale = disassociationAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.6, 1.25, 0.9],
            });

            return (
              <Animated.View
                key={px.id}
                style={[
                  styles.pixelBlock,
                  {
                    backgroundColor: px.color,
                    opacity: pixelOpacity,
                    transform: [
                      { translateX },
                      { translateY },
                      { rotate },
                      { scale },
                    ],
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Brand Title & Tagline below logo */}
        <Animated.View style={styles.brandTitleCol}>
          <Text style={[styles.brandTitleText, { color: isDark ? '#FFFFFF' : '#0F1117' }]}>
            BLINK
          </Text>
          <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>
            PHYSICAL SOLANA ACTIONS
          </Text>
        </Animated.View>
      </View>

      {/* ─── BOTTOM PROGRESS LINE INDICATOR ───────────────────────────────────── */}
      <View style={styles.bottomProgressTrack}>
        <Animated.View
          style={[
            styles.bottomProgressBar,
            {
              width: progressWidth,
              backgroundColor: colors.accent,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pixelCanvas: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  solidLogoWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pixelBlock: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 3,
    shadowColor: '#5B67F6',
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 3,
  },
  brandTitleCol: {
    alignItems: 'center',
    gap: 6,
  },
  brandTitleText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    textAlign: 'center',
  },

  // ─── BOTTOM PROGRESS ───────────────────────────────────────────────────────
  bottomProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(91, 103, 246, 0.15)',
  },
  bottomProgressBar: {
    height: '100%',
  },
});
