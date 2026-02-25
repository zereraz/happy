import { useAuth } from '@/auth/AuthContext';
import * as React from 'react';
import { Drawer } from 'expo-router/drawer';
import { useIsTablet } from '@/utils/responsive';
import { SidebarView } from './SidebarView';
import { Slot } from 'expo-router';
import { View, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSettingMutable } from '@/sync/storage';
import { useUnistyles } from 'react-native-unistyles';

export const SidebarNavigator = React.memo(() => {
    const auth = useAuth();
    const isTablet = useIsTablet();
    const showPermanentDrawer = auth.isAuthenticated && isTablet;
    const { width: windowWidth } = useWindowDimensions();
    const [sidebarCollapsed, setSidebarCollapsed] = useLocalSettingMutable('sidebarCollapsed');
    const { theme } = useUnistyles();

    const isCollapsed = showPermanentDrawer && sidebarCollapsed && Platform.OS === 'web';

    // Calculate drawer width only when needed
    const drawerWidth = React.useMemo(() => {
        if (!showPermanentDrawer) return 280; // Default width for hidden drawer
        if (isCollapsed) return 0;
        return Math.min(Math.max(Math.floor(windowWidth * 0.3), 250), 360);
    }, [windowWidth, showPermanentDrawer, isCollapsed]);

    const drawerNavigationOptions = React.useMemo(() => {
        if (!showPermanentDrawer || isCollapsed) {
            // When drawer is hidden, use minimal configuration
            return {
                lazy: false,
                headerShown: false,
                drawerType: 'front' as const,
                swipeEnabled: false,
                drawerStyle: {
                    width: 0,
                    display: 'none' as const,
                },
            };
        }

        // When drawer is permanent
        return {
            lazy: false,
            headerShown: false,
            drawerType: 'permanent' as const,
            drawerStyle: {
                backgroundColor: 'white',
                borderRightWidth: 0,
                width: drawerWidth,
            },
            swipeEnabled: false,
            drawerActiveTintColor: 'transparent',
            drawerInactiveTintColor: 'transparent',
            drawerItemStyle: { display: 'none' as const },
            drawerLabelStyle: { display: 'none' as const },
        };
    }, [showPermanentDrawer, drawerWidth, isCollapsed]);

    // Always render SidebarView but hide it when not needed
    const drawerContent = React.useCallback(
        () => <SidebarView onCollapse={() => setSidebarCollapsed(true)} />,
        [setSidebarCollapsed]
    );

    return (
        <View style={{ flex: 1 }}>
            <Drawer
                screenOptions={drawerNavigationOptions}
                drawerContent={showPermanentDrawer && !isCollapsed ? drawerContent : undefined}
            />
            {isCollapsed && (
                <Pressable
                    onPress={() => setSidebarCollapsed(false)}
                    hitSlop={8}
                    style={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        zIndex: 100,
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: theme.colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: theme.colors.divider,
                    }}
                >
                    <Ionicons name="menu-outline" size={20} color={theme.colors.text} />
                </Pressable>
            )}
        </View>
    )
});