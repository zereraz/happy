import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import { darkTheme, lightTheme } from './theme';
import { loadThemePreference, loadThemeId } from './sync/persistence';
import { getThemeFamily, setTauriWindowTheme } from './themes';
import type { Theme } from './theme';
import { Appearance } from 'react-native';
import * as SystemUI from 'expo-system-ui';

//
// Theme
//

// Load selected theme family and build the theme pair
const themeId = loadThemeId();
const family = getThemeFamily(themeId);
const isDefault = themeId === 'default';

const appThemes = {
    light: isDefault ? lightTheme : { ...lightTheme, colors: family.light } as Theme,
    dark: isDefault ? darkTheme : { ...darkTheme, colors: family.dark } as Theme,
};

const breakpoints = {
    xs: 0, // <-- make sure to register one breakpoint with value 0
    sm: 300,
    md: 500,
    lg: 800,
    xl: 1200
    // use as many breakpoints as you need
};

// Load theme preference from storage
const themePreference = loadThemePreference();

// Determine initial theme and adaptive settings
const getInitialTheme = (): 'light' | 'dark' => {
    if (themePreference === 'adaptive') {
        const systemTheme = Appearance.getColorScheme();
        return systemTheme === 'dark' ? 'dark' : 'light';
    }
    return themePreference;
};

const settings = themePreference === 'adaptive'
    ? {
        // When adaptive, let Unistyles handle theme switching automatically
        adaptiveThemes: true,
        CSSVars: true, // Enable CSS variables for web
    }
    : {
        // When fixed theme, set the initial theme explicitly
        initialTheme: getInitialTheme(),
        CSSVars: true, // Enable CSS variables for web
    };

//
// Bootstrap
//

type AppThemes = typeof appThemes
type AppBreakpoints = typeof breakpoints

declare module 'react-native-unistyles' {
    export interface UnistylesThemes extends AppThemes { }
    export interface UnistylesBreakpoints extends AppBreakpoints { }
}

StyleSheet.configure({
    settings,
    breakpoints,
    themes: appThemes,
})

// Set initial root view background color based on theme
const setRootBackgroundColor = () => {
    if (themePreference === 'adaptive') {
        const systemTheme = Appearance.getColorScheme();
        const color = systemTheme === 'dark' ? appThemes.dark.colors.groupped.background : appThemes.light.colors.groupped.background;
        UnistylesRuntime.setRootViewBackgroundColor(color);
        SystemUI.setBackgroundColorAsync(color);
    } else {
        const color = themePreference === 'dark' ? appThemes.dark.colors.groupped.background : appThemes.light.colors.groupped.background;
        UnistylesRuntime.setRootViewBackgroundColor(color);
        SystemUI.setBackgroundColorAsync(color);
    }
};

// Set initial background color
setRootBackgroundColor();

// Sync Tauri window title bar with the active theme
const initialIsDark = themePreference === 'adaptive'
    ? Appearance.getColorScheme() === 'dark'
    : themePreference === 'dark';
const initialBgColor = initialIsDark
    ? appThemes.dark.colors.groupped.background
    : appThemes.light.colors.groupped.background;
setTauriWindowTheme(initialIsDark, initialBgColor);
