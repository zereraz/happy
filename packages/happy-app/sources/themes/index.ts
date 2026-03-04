import { Platform } from 'react-native';
import { defaultTheme } from './default';
import { nordTheme } from './nord';
import { draculaTheme } from './dracula';
import { solarizedTheme } from './solarized';
import { catppuccinTheme } from './catppuccin';
import { rosepineTheme } from './rosepine';
import { gruvboxTheme } from './gruvbox';
import { tokyonightTheme } from './tokyonight';
import { onedarkTheme } from './onedark';
import { ayuTheme } from './ayu';

export type { ThemeColors, ThemeFamily } from './types';

export const themeRegistry = [
    defaultTheme,
    catppuccinTheme,
    nordTheme,
    draculaTheme,
    solarizedTheme,
    rosepineTheme,
    gruvboxTheme,
    tokyonightTheme,
    onedarkTheme,
    ayuTheme,
] as const;

export function getThemeFamily(id: string) {
    return themeRegistry.find(t => t.id === id) ?? defaultTheme;
}

/**
 * Convert hex color (#RRGGBB) to Tauri RGBA format (#RRGGBBAA).
 */
function hexToRgba(hex: string): string {
    const c = hex.replace('#', '');
    if (c.length === 6) return `#${c}ff`;
    return hex;
}

/**
 * Set the native Tauri window theme and background color to match the active theme.
 * No-op on non-Tauri platforms (iOS, Android, regular web).
 */
export function setTauriWindowTheme(isDark: boolean, backgroundColor?: string) {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (!tauri?.invoke) return;

    // Set native window appearance (title bar light/dark chrome)
    tauri.invoke('plugin:window|set_theme', {
        label: 'main',
        value: isDark ? 'Dark' : 'Light',
    }).catch((e: any) => console.warn('[tauri] set_theme failed:', e));

    // Set window background color (tints the title bar on macOS)
    if (backgroundColor) {
        tauri.invoke('plugin:window|set_background_color', {
            label: 'main',
            value: hexToRgba(backgroundColor),
        }).catch((e: any) => console.warn('[tauri] set_background_color failed:', e));
    }
}

export {
    defaultTheme, catppuccinTheme, nordTheme, draculaTheme, solarizedTheme,
    rosepineTheme, gruvboxTheme, tokyonightTheme, onedarkTheme, ayuTheme,
};
