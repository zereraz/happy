// Theme color types - separated to avoid circular imports

export interface ThemeColors {
    text: string;
    textDestructive: string;
    textSecondary: string;
    textLink: string;
    deleteAction: string;
    warningCritical: string;
    warning: string;
    success: string;
    surface: string;
    surfaceRipple: string;
    surfacePressed: string;
    surfaceSelected: string;
    surfacePressedOverlay: string;
    surfaceHigh: string;
    surfaceHighest: string;
    divider: string;
    shadow: { color: string; opacity: number };
    groupped: { background: string; chevron: string; sectionTitle: string };
    header: { background: string; tint: string };
    switch: { track: { active: string; inactive: string }; thumb: { active: string; inactive: string } };
    fab: { background: string; backgroundPressed: string; icon: string };
    radio: { active: string; inactive: string; dot: string };
    modal: { border: string };
    button: { primary: { background: string; tint: string; disabled: string }; secondary: { tint: string } };
    input: { background: string; text: string; placeholder: string };
    box: {
        warning: { background: string; border: string; text: string };
        error: { background: string; border: string; text: string };
    };
    status: { connected: string; connecting: string; disconnected: string; error: string; default: string };
    permission: { default: string; acceptEdits: string; bypass: string; plan: string; readOnly: string; safeYolo: string; yolo: string };
    permissionButton: {
        allow: { background: string; text: string };
        deny: { background: string; text: string };
        allowAll: { background: string; text: string };
        inactive: { background: string; border: string; text: string };
        selected: { background: string; border: string; text: string };
    };
    diff: {
        outline: string; success: string; error: string;
        addedBg: string; addedBorder: string; addedText: string;
        removedBg: string; removedBorder: string; removedText: string;
        contextBg: string; contextText: string;
        lineNumberBg: string; lineNumberText: string;
        hunkHeaderBg: string; hunkHeaderText: string;
        leadingSpaceDot: string;
        inlineAddedBg: string; inlineAddedText: string;
        inlineRemovedBg: string; inlineRemovedText: string;
    };
    userMessageBackground: string;
    userMessageText: string;
    agentMessageText: string;
    agentEventText: string;
    syntaxKeyword: string;
    syntaxString: string;
    syntaxComment: string;
    syntaxNumber: string;
    syntaxFunction: string;
    syntaxBracket1: string;
    syntaxBracket2: string;
    syntaxBracket3: string;
    syntaxBracket4: string;
    syntaxBracket5: string;
    syntaxDefault: string;
    gitBranchText: string;
    gitFileCountText: string;
    gitAddedText: string;
    gitRemovedText: string;
    terminal: { background: string; prompt: string; command: string; stdout: string; stderr: string; error: string; emptyOutput: string };
}

export interface ThemeFamily {
    id: string;
    name: string;
    light: ThemeColors;
    dark: ThemeColors;
}
