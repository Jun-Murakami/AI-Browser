import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Settings } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  IconButton,
  Tabs,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/system';

import { BROWSERS } from '../../constants/browsers';
import { DraggableTab } from './DraggableTab';

import type { DragEndEvent } from '@dnd-kit/core';
import type { Tab as TabType } from '../../types/tab.types';

interface TabBarProps {
  isInitialized: boolean;
  visibleTabs: TabType[];
  activeTabId: string | null;
  isEditingBrowserShow: boolean;
  browserLoadings: boolean[];
  onTabChange: (event: React.SyntheticEvent, index: number) => void;
  onToggleEditMode: () => void;
  onToggleTabEnabled: (tabId: string) => void;
  onTabReorder: (tabId: string, newOrder: number) => void;
}

export function TabBar({
  isInitialized,
  visibleTabs,
  activeTabId,
  isEditingBrowserShow,
  browserLoadings,
  onTabChange,
  onToggleEditMode,
  onToggleTabEnabled,
  onTabReorder,
}: TabBarProps) {
  const theme = useTheme();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px以上ドラッグしてから開始
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    // over は null の可能性があるためガード
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId !== overId) {
      const oldIndex = visibleTabs.findIndex((tab) => tab.id === activeId);
      const newIndex = visibleTabs.findIndex((tab) => tab.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        onTabReorder(activeId, visibleTabs[newIndex].order);
      }
    }
  };

  return (
    <Box
      aria-label="Browser tabs container"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      <Tooltip
        title="(Ctrl + Tab) to switch AI"
        placement="right"
        arrow
        slotProps={{
          popper: {
            modifiers: [
              {
                name: 'offset',
                options: {
                  offset: [0, 40],
                },
              },
            ],
          },
        }}
      >
        {isInitialized && visibleTabs.length > 0 ? (
          <Box sx={{ position: 'relative', width: 'calc(100% - 48px)' }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={visibleTabs.map((tab) => tab.id)}
                strategy={horizontalListSortingStrategy}
              >
                <Tabs
                  value={visibleTabs.findIndex((tab) => tab.id === activeTabId)}
                  onChange={onTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    borderBottom: 1,
                    borderColor: theme.palette.divider,
                    '& .MuiTabs-scrollButtons': {
                      '&.Mui-disabled': {
                        opacity: 0.3,
                      },
                    },
                  }}
                  key="browser-tabs"
                >
                  {visibleTabs.map((tab, index) => (
                    <DraggableTab
                      key={tab.id}
                      id={tab.id}
                      tabId={tab.id}
                      isEditingBrowserShow={isEditingBrowserShow}
                      enabled={tab.enabled !== false}
                      onToggleTabEnabled={() => onToggleTabEnabled(tab.id)}
                      index={index}
                      label={tab.label}
                      loading={
                        tab.type === 'browser'
                          ? browserLoadings[
                              BROWSERS.findIndex((b) => b.id === tab.id)
                            ]
                          : false
                      }
                      onClick={onTabChange}
                      icon={tab.IconComponent ?? null}
                      isTerminal={tab.type === 'terminal'}
                    />
                  ))}
                </Tabs>
              </SortableContext>
            </DndContext>
          </Box>
        ) : (
          <Box
            sx={{
              borderBottom: 1,
              borderColor: theme.palette.divider,
              width: '100%',
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress size={24} />
          </Box>
        )}
      </Tooltip>
      <Box>
        <Tooltip title="Edit tabs" placement="right" arrow>
          <IconButton
            onClick={onToggleEditMode}
            sx={{
              color: isEditingBrowserShow
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
            }}
          >
            <Settings />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
