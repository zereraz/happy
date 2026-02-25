import { Ionicons } from '@expo/vector-icons';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useSettingMutable } from '@/sync/storage';
import { Switch } from '@/components/Switch';
import { t } from '@/text';

export default function ForkSettingsScreen() {
    const [forkFlags, setForkFlags] = useSettingMutable('forkFlags');

    const toggleFlag = (key: string) => {
        setForkFlags({ ...forkFlags, [key]: !(forkFlags[key] ?? false) });
    };

    const customSidebar = forkFlags['customSidebar'] ?? false;

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
        </ItemList>
    );
}
