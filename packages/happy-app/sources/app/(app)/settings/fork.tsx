import React, { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useSettingMutable, useGroups } from '@/sync/storage';
import { Switch } from '@/components/Switch';
import { t } from '@/text';
import { Modal } from '@/modal';
import { groupCreate, groupUpdate, groupDelete } from '@/sync/ops';
import { useUnistyles } from 'react-native-unistyles';

export default function ForkSettingsScreen() {
    const { theme } = useUnistyles();
    const [forkFlags, setForkFlags] = useSettingMutable('forkFlags');
    const groups = useGroups();

    const toggleFlag = (key: string) => {
        setForkFlags({ ...forkFlags, [key]: !(forkFlags[key] ?? false) });
    };

    const customSidebar = forkFlags['customSidebar'] ?? false;

    const handleCreateGroup = useCallback(async () => {
        const name = await Modal.prompt('New Group', 'Enter group name', { placeholder: 'Group name' });
        if (!name || !name.trim()) return;
        const result = await groupCreate(name.trim());
        if (!result.success) {
            Modal.alert('Error', result.message || 'Failed to create group');
        }
    }, []);

    const handleRenameGroup = useCallback(async (groupId: string, currentName: string) => {
        const name = await Modal.prompt('Rename Group', 'Enter new name', {
            defaultValue: currentName,
            placeholder: 'Group name',
        });
        if (!name || !name.trim() || name.trim() === currentName) return;
        const result = await groupUpdate(groupId, { name: name.trim() });
        if (!result.success) {
            Modal.alert('Error', result.message || 'Failed to rename group');
        }
    }, []);

    const handleDeleteGroup = useCallback((groupId: string, groupName: string) => {
        Modal.alert(
            'Delete Group',
            `Delete "${groupName}"? Sessions in this group will become ungrouped.`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await groupDelete(groupId);
                        if (!result.success) {
                            Modal.alert('Error', result.message || 'Failed to delete group');
                        }
                    },
                },
            ]
        );
    }, []);

    return (
        <ItemList style={{ paddingTop: 0 }}>
            <ItemGroup
                title={t('settingsFork.sidebar')}
                footer={t('settingsFork.sidebarDescription')}
            >
                <Item
                    title={t('settingsFork.customSidebar')}
                    subtitle={customSidebar
                        ? t('settingsFork.customSidebarEnabled')
                        : t('settingsFork.customSidebarDisabled')
                    }
                    icon={<Ionicons name="grid-outline" size={29} color="#FF6347" />}
                    rightElement={
                        <Switch
                            value={customSidebar}
                            onValueChange={() => toggleFlag('customSidebar')}
                        />
                    }
                    showChevron={false}
                />
            </ItemGroup>

            {customSidebar && (
                <ItemGroup
                    title="Groups"
                    footer="Groups let you organize sessions. Assign sessions to groups from their info page."
                >
                    {groups.map((group) => (
                        <Item
                            key={group.id}
                            title={group.name}
                            icon={<Ionicons name="folder-outline" size={29} color="#5AC8FA" />}
                            onPress={() => handleRenameGroup(group.id, group.name)}
                            onLongPress={() => handleDeleteGroup(group.id, group.name)}
                        />
                    ))}
                    <Item
                        title="Add Group"
                        icon={<Ionicons name="add-circle-outline" size={29} color="#34C759" />}
                        onPress={handleCreateGroup}
                    />
                </ItemGroup>
            )}
        </ItemList>
    );
}
