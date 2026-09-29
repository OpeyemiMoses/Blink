import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

interface SparklineChartProps {
  basePrice?: number;
  currency?: string;
  volumeLabel?: string;
}

export const SparklineChart: React.FC<SparklineChartProps> = ({
  basePrice = 5.0,
  currency = 'USDC',
  volumeLabel = '$21.5K Vol',
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | 'All'>('1D');

  // Realistic dynamic points for the wave
  const points = [
    { x: 10, y: 130 },
    { x: 30, y: 110 },
    { x: 50, y: 145 },
    { x: 70, y: 80 },
    { x: 90, y: 120 },
    { x: 110, y: 95 },
    { x: 130, y: 140 },
    { x: 150, y: 65 },
    { x: 170, y: 90 },
    { x: 190, y: 55 },
    { x: 210, y: 85 },
    { x: 230, y: 105 },
    { x: 250, y: 40 },
    { x: 270, y: 70 },
    { x: 290, y: 60 },
    { x: 310, y: 95 },
    { x: 330, y: 45 },
    { x: 350, y: 50 },
  ];

  const pathD = points.reduce(
    (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`,
    ''
  );

  const fillD = `${pathD} L 350 170 L 10 170 Z`;

  return (
    <View style={styles.chartContainer}>
      {/* Chart Top Metadata */}
      <View style={styles.chartHeader}>
        <Text style={styles.gridLabel}>Activity Matrix</Text>
        <Text style={styles.dragLabel}>Live Solana Settlement</Text>
      </View>

      {/* SVG Canvas */}
      <View style={styles.svgWrapper}>
        <Svg width="100%" height={180} viewBox="0 0 360 180">
          <Defs>
            <LinearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="180" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#14F195" stopOpacity="0.22" />
              <Stop offset="100%" stopColor="#14F195" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          <Line x1="10" y1="35" x2="350" y2="35" stroke="#1B1E28" strokeWidth="1" strokeDasharray="3,3" />
          <Line x1="10" y1="85" x2="350" y2="85" stroke="#1B1E28" strokeWidth="1" strokeDasharray="3,3" />
          <Line x1="10" y1="135" x2="350" y2="135" stroke="#1B1E28" strokeWidth="1" strokeDasharray="3,3" />

          {/* Vertical Grid Marks */}
          <Line x1="90" y1="20" x2="90" y2="155" stroke="#1B1E28" strokeWidth="1" strokeDasharray="3,3" />
          <Line x1="180" y1="20" x2="180" y2="155" stroke="#1B1E28" strokeWidth="1" strokeDasharray="3,3" />
          <Line x1="270" y1="20" x2="270" y2="155" stroke="#1B1E28" strokeWidth="1" strokeDasharray="3,3" />

          {/* Gradient Fill */}
          <Path d={fillD} fill="url(#chartGlow)" />

          {/* Main Neon Green Wave Line */}
          <Path
            d={pathD}
            stroke="#14F195"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* High Marker Badge */}
          <SvgText x="238" y="32" fill="#64748B" fontSize="9" fontWeight="700">
            H ${(basePrice * 1.05).toFixed(2)}
          </SvgText>

          {/* Low Marker Badge */}
          <SvgText x="50" y="158" fill="#64748B" fontSize="9" fontWeight="700">
            L ${(basePrice * 0.96).toFixed(2)}
          </SvgText>

          {/* Current Right Marker Pill */}
          <Rect x="306" y="36" width="48" height="20" rx="6" fill="#14F195" />
          <SvgText x="312" y="50" fill="#070A10" fontSize="10" fontWeight="800">
            ${basePrice.toFixed(2)}
          </SvgText>
        </Svg>
      </View>

      {/* Time Axis Labels */}
      <View style={styles.timeAxis}>
        <Text style={styles.timeLabel}>11:00</Text>
        <Text style={styles.timeLabel}>15:00</Text>
        <Text style={styles.timeLabel}>19:00</Text>
        <Text style={styles.timeLabel}>Now</Text>
      </View>

      {/* Timeframe Selector Pills */}
      <View style={styles.timeframeRow}>
        {(['1D', '1W', '1M', 'All'] as const).map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[styles.tfPill, selectedTimeframe === tf && styles.tfPillActive]}
            onPress={() => setSelectedTimeframe(tf)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tfText, selectedTimeframe === tf && styles.tfTextActive]}>
              {tf}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: '#090B10',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#181C26',
    padding: 16,
    marginBottom: 20,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  dragLabel: {
    fontSize: 10,
    color: '#475569',
  },
  svgWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 4,
  },
  timeAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  timeLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tfPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#0F121A',
    borderWidth: 1,
    borderColor: '#191E2B',
  },
  tfPillActive: {
    backgroundColor: '#1E2333',
    borderColor: '#2D354A',
  },
  tfText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tfTextActive: {
    color: '#FFFFFF',
  },
});
