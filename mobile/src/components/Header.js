import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Image } from 'react-native';
import { Terminal, Sun, Moon } from 'lucide-react-native';

export const Header = ({
  colors,
  socketConnected,
  userId,
  isDark,
  toggleTheme,
  showDevConsole,
  setShowDevConsole
}) => {
  return (
    <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.cardBorder }]}>
      {/* Official Brand Logo & Title */}
      <View style={styles.brandRow}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>OxiDrop</Text>
      </View>

      {/* Right Controls */}
      <View style={styles.headerRight}>
        {/* Connection Status Chip */}
        <View
          style={[
            styles.statusChip,
            {
              backgroundColor: socketConnected ? colors.greenBg : colors.redBg,
              borderColor: socketConnected ? colors.greenBorder : colors.redBorder,
            }
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: socketConnected ? colors.green : colors.red }
            ]}
          />
          <Text
            style={[
              styles.statusChipText,
              { color: socketConnected ? colors.green : colors.red }
            ]}
          >
            {socketConnected ? 'Online' : 'Offline'}
          </Text>
        </View>

        {/* Node ID Badge */}
        {userId && (
          <View style={[styles.nodeIdBadge, { backgroundColor: colors.insetBg, borderColor: colors.insetBorder }]}>
            <Text style={[styles.nodeIdText, { color: colors.textSecondary }]}>{userId}</Text>
          </View>
        )}

        {/* Diagnostics Button */}
        <Pressable
          style={[
            styles.iconBtn,
            {
              backgroundColor: showDevConsole ? colors.primaryBtn : colors.secondaryBtn,
              borderColor: showDevConsole ? colors.primaryBtn : colors.secondaryBtnBorder,
            }
          ]}
          onPress={() => setShowDevConsole(!showDevConsole)}
        >
          <Terminal size={14} color={showDevConsole ? '#fff' : colors.textSecondary} />
        </Pressable>

        {/* Theme Button */}
        <Pressable
          style={[styles.iconBtn, { backgroundColor: colors.secondaryBtn, borderColor: colors.secondaryBtnBorder }]}
          onPress={toggleTheme}
        >
          {isDark ? <Sun size={14} color={colors.amber} /> : <Moon size={14} color="#6366f1" />}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 24,
    height: 24,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  nodeIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  nodeIdText: {
    fontSize: 10.5,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
