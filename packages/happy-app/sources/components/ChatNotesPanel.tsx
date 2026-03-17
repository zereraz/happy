import * as React from 'react';
import { View, Text, TextInput, Pressable, Platform, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { useSessionNotes } from '@/hooks/useSessionNotes';
import { t } from '@/text';

const MIN_WIDTH = 200;
const MAX_WIDTH = 600;

interface ChatNotesPanelProps {
    sessionId: string;
    onClose: () => void;
    width: number;
    onWidthChange: (width: number) => void;
}

export const ChatNotesPanel = React.memo(({ sessionId, onClose, width, onWidthChange }: ChatNotesPanelProps) => {
    const [notes, setNotes] = useSessionNotes(sessionId);
    const { theme } = useUnistyles();
    const startWidthRef = React.useRef(width);

    const panResponder = React.useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            startWidthRef.current = width;
        },
        onPanResponderMove: (_e, gestureState) => {
            // Dragging left (negative dx) = wider panel, dragging right = narrower
            const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current - gestureState.dx));
            onWidthChange(newWidth);
        },
    }), [onWidthChange, width]);

    return (
        <View style={[styles.container, { width }]}>
            <View {...panResponder.panHandlers} style={[styles.dragHandle, { borderLeftColor: theme.colors.divider }]}>
                <View style={[styles.dragIndicator, { backgroundColor: theme.colors.textSecondary }]} />
            </View>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>{t('chatNotes.title')}</Text>
                    <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
                        <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                    </Pressable>
                </View>
                <TextInput
                    style={styles.editor}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholder={t('chatNotes.placeholder')}
                    placeholderTextColor={theme.colors.textSecondary}
                    textAlignVertical="top"
                    autoFocus={false}
                    scrollEnabled
                />
            </View>
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        ...Platform.select({
            web: { height: '100%' as any },
            default: { flex: 1 },
        }),
    },
    dragHandle: {
        width: 6,
        justifyContent: 'center',
        alignItems: 'center',
        borderLeftWidth: StyleSheet.hairlineWidth,
        ...Platform.select({
            web: { cursor: 'col-resize' as any },
            default: {},
        }),
    },
    dragIndicator: {
        width: 3,
        height: 32,
        borderRadius: 1.5,
        opacity: 0.3,
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.divider,
    },
    title: {
        fontSize: 15,
        color: theme.colors.text,
        ...Typography.default('semiBold'),
    },
    closeButton: {
        padding: 4,
    },
    editor: {
        flex: 1,
        padding: 16,
        fontSize: 14,
        lineHeight: 20,
        color: theme.colors.text,
        ...Typography.default(),
        ...Platform.select({
            web: { outlineStyle: 'none' as any },
            default: {},
        }),
    },
}));
