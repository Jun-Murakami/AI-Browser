import { useSortable } from '@dnd-kit/sortable';
import { Box } from '@mui/material';

import BrowserTab from './BrowserTab';

import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';

interface DraggableTabProps {
  id: string;
  tabId: string;
  index: number;
  label: string;
  loading: boolean;
  enabled: boolean;
  isEditingBrowserShow: boolean;
  isTerminal: boolean;
  icon: ComponentType<SvgIconProps> | null;
  onToggleTabEnabled: () => void;
  onClick: (event: React.SyntheticEvent, index: number) => void;
}

export function DraggableTab({
  id,
  tabId,
  index,
  label,
  loading,
  enabled,
  isEditingBrowserShow,
  isTerminal,
  icon,
  onToggleTabEnabled,
  onClick,
}: DraggableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: transform ? `translateX(${transform.x}px)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{ display: 'inline-flex' }}
    >
      <BrowserTab
        key={tabId}
        isEditingBrowserShow={isEditingBrowserShow}
        enabled={enabled}
        setEnabledBrowsers={onToggleTabEnabled}
        index={index}
        label={label}
        loading={loading}
        onClick={onClick}
        icon={icon}
        tabId={tabId}
        isTerminal={isTerminal}
      />
    </Box>
  );
}
