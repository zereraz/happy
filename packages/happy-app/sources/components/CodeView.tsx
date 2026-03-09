import * as React from 'react';
import { Text, View, ScrollView, Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface CodeViewProps {
    code: string;
    language?: string;
}

export const CodeView = React.memo<CodeViewProps>(({
    code,
    language
}) => {
    return (
        <View style={styles.codeBlock}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                nestedScrollEnabled={true}
            >
                <Text style={styles.codeText}>{code}</Text>
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    codeBlock: {
        backgroundColor: theme.colors.surfaceHigh,
        borderRadius: 6,
        padding: 12,
        // On web, constrain width so the horizontal ScrollView actually scrolls
        ...(Platform.OS === 'web' ? { maxWidth: '100%', overflow: 'hidden' } : {}),
    },
    codeText: {
        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
        fontSize: 12,
        color: theme.colors.text,
        lineHeight: 18,
    },
}));
