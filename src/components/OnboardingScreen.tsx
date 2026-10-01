import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Radio, Zap, AtSign, Bell, ChevronRight, X } from 'lucide-react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

interface OnboardingScreenProps {
  onFinish: () => void;
}

const slides = [
  {
    id: 'nfc',
    icon: Radio,
    iconColor: '#5B67F6',
    iconBg: 'rgba(91,103,246,0.12)',
    accent: '#5B67F6',
    tag: 'PHYSICAL PAYMENTS',
    title: 'Tap. Pay. Done.',
    desc: 'Hold your Seeker to any NFC tag or card. A payment page opens instantly — approve with one tap. No addresses, no friction.',
  },
  {
    id: 'blink',
    icon: Zap,
    iconColor: '#F59E0B',
    iconBg: 'rgba(245,158,11,0.12)',
    accent: '#F59E0B',
    tag: 'BLINK MARKETPLACE',
    title: 'Your Storefront. Any Token.',
    desc: 'Create a Blink — a sharable payment page for your product or service. Set your price in SOL, USDC, or SKR. Share a link or program an NFC tag.',
  },
  {
    id: 'p2p',
    icon: AtSign,
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.12)',
    accent: '#10B981',
    tag: 'PEER-TO-PEER',
    title: 'Pay by @username.',
    desc: 'Send SOL, USDC, or SKR to anyone by their @handle. No wallet addresses. No copy-paste. Just type and send.',
  },
  {
    id: 'notify',
    icon: Bell,
    iconColor: '#EC4899',
    iconBg: 'rgba(236,72,153,0.12)',
    accent: '#EC4899',
    tag: 'REAL-TIME ALERTS',
    title: 'Know the second you get paid.',
    desc: 'Instant sale notifications the moment a customer taps your Blink. Know exactly who paid, how much, and when.',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onFinish }) => {
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (index: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      goTo(currentIndex + 1);
    } else {
      onFinish();
    }
  };

  const slide = slides[currentIndex];
  const Icon = slide.icon;
  const isLast = currentIndex === slides.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#07080B' : '#F0F2F8' }]}>
      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={onFinish} activeOpacity={0.7}>
        <X size={18} color={colors.textMuted} />
        <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
      </TouchableOpacity>

      {/* Slide content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Big icon illustration */}
        <View style={[styles.iconCircle, { backgroundColor: slide.iconBg, borderColor: slide.accent + '40' }]}>
          <Icon size={64} color={slide.iconColor} strokeWidth={1.5} />
        </View>

        {/* Tag pill */}
        <View style={[styles.tagPill, { backgroundColor: slide.iconBg, borderColor: slide.accent }]}>
          <Icon size={10} color={slide.accent} />
          <Text style={[styles.tagText, { color: slide.accent }]}>{slide.tag}</Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>{slide.title}</Text>

        {/* Desc */}
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{slide.desc}</Text>

        {/* Feature bullets for first slide */}
        {slide.id === 'nfc' && (
          <View style={styles.bullets}>
            {['NFC tag tap → instant payment modal', 'Approve with biometrics, no signing friction', 'Works with any Solana wallet'].map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: slide.accent }]} />
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{b}</Text>
              </View>
            ))}
          </View>
        )}
        {slide.id === 'blink' && (
          <View style={styles.bullets}>
            {['SOL · USDC · SKR payments', 'Shareable link or programmable NFC tag', 'Real-time sale notifications'].map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: slide.accent }]} />
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{b}</Text>
              </View>
            ))}
          </View>
        )}
        {slide.id === 'p2p' && (
          <View style={styles.bullets}>
            {['@username — no wallet addresses', 'Send any token to any Blink user', 'Instant on-chain settlement'].map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: slide.accent }]} />
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{b}</Text>
              </View>
            ))}
          </View>
        )}
        {slide.id === 'notify' && (
          <View style={styles.bullets}>
            {['Push notification on every sale', 'Know amount, token, and payer', 'Never miss a payment again'].map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: slide.accent }]} />
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{b}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Bottom controls */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} activeOpacity={0.7}>
              <View
                style={[
                  styles.dot,
                  {
                    width: i === currentIndex ? 28 : 8,
                    backgroundColor: i === currentIndex ? slide.accent : (isDark ? '#2A2D40' : '#C8CBDC'),
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Next / Get Started */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.accent, shadowColor: slide.accent }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
          {!isLast && <ChevronRight size={18} color="#FFF" />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: Platform.OS === 'ios' ? 48 : 36,
    paddingHorizontal: 28,
  },
  skipBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 20,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 380,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 36,
  },
  desc: {
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 300,
  },
  bullets: {
    gap: 8,
    alignSelf: 'stretch',
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bulletText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    flex: 1,
  },
  bottom: {
    width: '100%',
    maxWidth: 380,
    gap: 20,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
