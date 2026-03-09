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
    const { messages, isLoaded } = useSessionMessages(props.session.id);
    return (
        <ChatListInternal
            metadata={props.session.metadata}
            sessionId={props.session.id}
            messages={messages}
            isLoaded={isLoaded}
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
    isLoaded: boolean,
}) => {
    // Use ref for metadata so renderItem stays stable across metadata changes.
    const metadataRef = React.useRef(props.metadata);
    metadataRef.current = props.metadata;

    const keyExtractor = useCallback((item: any) => item.id, []);
    const renderItem = useCallback(({ item }: { item: any }) => (
        <MessageView message={item} metadata={metadataRef.current} sessionId={props.sessionId} />
    ), [props.sessionId]);

    if (!isWeb) {
        return (
            <FlatList
                data={props.messages}
                inverted={true}
                keyExtractor={keyExtractor}
                maintainVisibleContentPosition={{
                    minIndexForVisible: 0,
                    autoscrollToTopThreshold: 10,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                renderItem={renderItem}
                ListHeaderComponent={<ListFooter sessionId={props.sessionId} />}
                ListFooterComponent={<ListHeader />}
            />
        );
    }

    return <WebChatList {...props} isLoaded={props.isLoaded} keyExtractor={keyExtractor} renderItem={renderItem} />;
});

// Web/Tauri: non-inverted list with manual scroll-to-bottom.
// scaleY(-1) inversion doesn't set initial scroll position correctly in WebKit,
// so we use a normal list with reversed data and scroll to the end ourselves.
const WebChatList = React.memo((props: {
    metadata: Metadata | null,
    sessionId: string,
    messages: Message[],
    isLoaded: boolean,
    keyExtractor: (item: any) => string,
    renderItem: (info: { item: any }) => React.ReactElement,
}) => {
    const flatListRef = React.useRef<FlatList>(null);
    // true until user scrolls away from bottom
    const isAtBottomRef = React.useRef(true);
    // Suppresses onScroll tracking during programmatic scrolls
    const isProgrammaticScrollRef = React.useRef(false);

    // Reverse data: oldest first, newest at bottom
    const data = React.useMemo(
        () => [...props.messages].reverse(),
        [props.messages]
    );

    const scrollToBottom = useCallback(() => {
        isProgrammaticScrollRef.current = true;
        flatListRef.current?.scrollToEnd({ animated: false });
        // Allow onScroll tracking again after scroll settles
        setTimeout(() => { isProgrammaticScrollRef.current = false; }, 300);
    }, []);

    // Scroll to bottom only after all messages have loaded
    const hasInitialScrollRef = React.useRef(false);
    React.useEffect(() => {
        if (props.isLoaded && data.length > 0 && !hasInitialScrollRef.current) {
            hasInitialScrollRef.current = true;
            setTimeout(scrollToBottom, 50);
        }
    }, [props.isLoaded, data.length, scrollToBottom]);

    // Auto-scroll to bottom when new content arrives (if user is near bottom)
    const onContentSizeChange = useCallback(() => {
        if (isAtBottomRef.current) {
            scrollToBottom();
        }
    }, [scrollToBottom]);

    // Track scroll position — skip during programmatic scrolls
    const onScroll = useCallback((event: any) => {
        if (isProgrammaticScrollRef.current) return;
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
        isAtBottomRef.current = distanceFromBottom < 150;
    }, []);

    return (
        <FlatList
            ref={flatListRef}
            data={data}
            keyExtractor={props.keyExtractor}
            // Disable virtualization — browser DOM handles it fine and
            // windowed rendering causes items to vanish during streaming.
            windowSize={999}
            removeClippedSubviews={false}
            initialNumToRender={999}
            contentContainerStyle={{ userSelect: 'text' as any }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            renderItem={props.renderItem}
            ListHeaderComponent={<ListHeader />}
            ListFooterComponent={<ListFooter sessionId={props.sessionId} />}
            onContentSizeChange={onContentSizeChange}
            onScroll={onScroll}
            scrollEventThrottle={100}
        />
    );
});
