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
import { useColorScheme, Text } from 'react-native';

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
                    tabBarIcon: () => <Text>📊</Text>,
                }}
            />
            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                    tabBarLabel: 'History',
                    tabBarIcon: () => <Text>📜</Text>,
                }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    tabBarLabel: 'Settings',
                    tabBarIcon: () => <Text>⚙️</Text>,
                }}
            />
        </Tab.Navigator>
    );
};
