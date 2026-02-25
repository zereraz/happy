import { defaultTheme } from './default';
import { nordTheme } from './nord';
import { draculaTheme } from './dracula';
import { solarizedTheme } from './solarized';

export type { ThemeColors, ThemeFamily } from './types';

export const themeRegistry = [
    defaultTheme,
    nordTheme,
    draculaTheme,
    solarizedTheme,
] as const;

export function getThemeFamily(id: string) {
    return themeRegistry.find(t => t.id === id) ?? defaultTheme;
}

export { defaultTheme, nordTheme, draculaTheme, solarizedTheme };
