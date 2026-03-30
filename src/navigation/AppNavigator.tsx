/**
 * App Navigator
 * Bottom tab navigation setup
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/DashboardScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { Colors } from '../styles/colors';
import { useColorScheme } from 'react-native';
import { ActivityIcon, ClockIcon, SettingsIcon, HeartPulseIcon } from '../components/SVGIcons';

const Tab = createBottomTabNavigator();

export const AppNavigator: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <Tab.Navigator
            screenOptions={{
                tabBarStyle: {
                    backgroundColor: isDark ? Colors.surface.dark : Colors.surface.light,
                    borderTopColor: isDark ? Colors.border.dark : Colors.border.light,
                },
                tabBarActiveTintColor: Colors.primary.dark,
                tabBarInactiveTintColor: isDark
                    ? Colors.text.tertiary.dark
                    : Colors.text.tertiary.light,
                headerStyle: {
                    backgroundColor: isDark ? Colors.surface.dark : Colors.surface.light,
                },
                headerTintColor: isDark
                    ? Colors.text.primary.dark
                    : Colors.text.primary.light,
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{
                    tabBarLabel: 'Dashboard',
                    tabBarIcon: ({ color, size }) => <HeartPulseIcon color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                    tabBarLabel: 'History',
                    tabBarIcon: ({ color, size }) => <ClockIcon color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    tabBarLabel: 'Settings',
                    tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
                }}
            />
        </Tab.Navigator>
    );
};
