import { Ionicons } from '@expo/vector-icons';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useSettingMutable } from '@/sync/storage';
import { Switch } from '@/components/Switch';
import { t } from '@/text';

// Define all fork-specific feature flags here.
// Adding a new flag is just one entry in this array — no schema changes needed.
const FORK_FLAGS = [
    {
        key: 'customSidebar',
        icon: 'grid-outline' as const,
        color: '#FF6347',
    },
] as const;

export default function ForkSettingsScreen() {
    const [forkFlags, setForkFlags] = useSettingMutable('forkFlags');

    const toggleFlag = (key: string) => {
        setForkFlags({ ...forkFlags, [key]: !(forkFlags[key] ?? false) });
    };

    return (
        <ItemList style={{ paddingTop: 0 }}>
            <ItemGroup
                title={t('settingsFork.sidebar')}
                footer={t('settingsFork.sidebarDescription')}
            >
                {FORK_FLAGS.map((flag) => (
                    <Item
                        key={flag.key}
                        title={t(`settingsFork.${flag.key}` as any)}
                        subtitle={
                            (forkFlags[flag.key] ?? false)
                                ? t(`settingsFork.${flag.key}Enabled` as any)
                                : t(`settingsFork.${flag.key}Disabled` as any)
                        }
                        icon={<Ionicons name={flag.icon} size={29} color={flag.color} />}
                        rightElement={
                            <Switch
                                value={forkFlags[flag.key] ?? false}
                                onValueChange={() => toggleFlag(flag.key)}
                            />
                        }
                        showChevron={false}
                    />
                ))}
            </ItemGroup>
        </ItemList>
    );
}
