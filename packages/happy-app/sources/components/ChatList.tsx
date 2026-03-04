import * as React from 'react';
import { useSessionMessages, storage } from "@/sync/storage";
import { FlatList, Platform, View } from 'react-native';
import { useCallback } from 'react';
import { useHeaderHeight } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageView } from './MessageView';
import { Metadata, Session } from '@/sync/storageTypes';
import { ChatFooter } from './ChatFooter';
import { Message } from '@/sync/typesMessage';

const isWeb = Platform.OS === 'web';

export const ChatList = React.memo((props: { session: Session }) => {
    const { messages } = useSessionMessages(props.session.id);
    return (
        <ChatListInternal
            metadata={props.session.metadata}
            sessionId={props.session.id}
            messages={messages}
        />
    )
});

const ListHeader = React.memo(() => {
    const headerHeight = useHeaderHeight();
    const safeArea = useSafeAreaInsets();
    return <View style={{ flexDirection: 'row', alignItems: 'center', height: headerHeight + safeArea.top + 32 }} />;
});

const ListFooter = React.memo((props: { sessionId: string }) => {
    const controlledByUser = storage(
        React.useCallback((state: any) => state.sessions[props.sessionId]?.agentState?.controlledByUser || false, [props.sessionId])
    );
    return (
        <ChatFooter controlledByUser={controlledByUser} />
    )
});

const ChatListInternal = React.memo((props: {
    metadata: Metadata | null,
    sessionId: string,
    messages: Message[],
}) => {
    // Use ref for metadata so renderItem stays stable across metadata changes.
    // MessageView reads the latest metadata via ref without causing FlatList to
    // recreate all visible items.
    const metadataRef = React.useRef(props.metadata);
    metadataRef.current = props.metadata;

    const flatListRef = React.useRef<FlatList>(null);
    // Track whether user is scrolled to the bottom (for web auto-scroll)
    const isAtBottomRef = React.useRef(true);

    // On web: reverse messages for non-inverted list (oldest first, newest at bottom).
    // On native: keep original order (newest first, inverted renders it bottom-up).
    const data = React.useMemo(
        () => isWeb ? [...props.messages].reverse() : props.messages,
        [props.messages]
    );

    const keyExtractor = useCallback((item: any) => item.id, []);
    const renderItem = useCallback(({ item }: { item: any }) => (
        <MessageView message={item} metadata={metadataRef.current} sessionId={props.sessionId} />
    ), [props.sessionId]);

    // Web: auto-scroll to bottom when new content arrives (if user is near bottom)
    const onContentSizeChange = useCallback(() => {
        if (isAtBottomRef.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
        }
    }, []);

    // Web: track scroll position to decide whether to auto-scroll
    const onScroll = useCallback((event: any) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
        isAtBottomRef.current = distanceFromBottom < 150;
    }, []);

    return (
        <FlatList
            ref={flatListRef}
            data={data}
            inverted={!isWeb}
            keyExtractor={keyExtractor}
            {...(!isWeb && {
                maintainVisibleContentPosition: {
                    minIndexForVisible: 0,
                    autoscrollToTopThreshold: 100,
                },
            })}
            // On web, disable virtualization — browser DOM handles it fine and
            // windowed rendering causes items to vanish during streaming updates.
            windowSize={isWeb ? 999 : 11}
            {...(isWeb && { removeClippedSubviews: false, initialNumToRender: 999 })}
            // On web, allow drag-to-select text across message boundaries
            {...(isWeb && { contentContainerStyle: { userSelect: 'text' as const } })}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            renderItem={renderItem}
            // Inverted swaps header/footer visually. On web (non-inverted) use normal order.
            ListHeaderComponent={isWeb ? <ListHeader /> : <ListFooter sessionId={props.sessionId} />}
            ListFooterComponent={isWeb ? <ListFooter sessionId={props.sessionId} /> : <ListHeader />}
            {...(isWeb && {
                onContentSizeChange,
                onScroll,
                scrollEventThrottle: 100,
            })}
        />
    )
});
