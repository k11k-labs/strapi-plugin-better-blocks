import * as React from 'react';
import { Flex, Tooltip } from '@strapi/design-system';
import { Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useSlateStatic } from 'slate-react';
import { styled } from 'styled-components';

import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
} from '../FontModifiersIcons';
import type { TableCellAlign } from '../utils/types';
import {
  DeleteColumnIcon,
  DeleteRowIcon,
  HeaderRowIcon,
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  InsertRowAboveIcon,
  InsertRowBelowIcon,
} from './TableIcons';
import {
  type TableLocation,
  deleteColumn,
  deleteRow,
  deleteTable,
  getCellAlign,
  hasHeaderRow,
  insertColumn,
  insertRow,
  setCellAlign,
  toggleHeaderRow,
} from './tableOperations';

const Bar = styled(Flex)`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme }) => theme.shadows.filterShadow};
  padding: 2px;
`;

const Separator = styled.span`
  width: 1px;
  align-self: stretch;
  margin: 2px 2px;
  background: ${({ theme }) => theme.colors.neutral200};
`;

const BarButton = styled.button<{ $active?: boolean; $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.8rem;
  height: 2.8rem;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  cursor: pointer;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary100 : 'transparent'};

  &:hover {
    background: ${({ theme, $danger }) =>
      $danger ? theme.colors.danger100 : theme.colors.primary100};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: -2px;
  }
`;

interface ActionProps {
  label: string;
  icon: React.ComponentType<{ fill?: string }>;
  onAction: () => void;
  isActive?: boolean;
  isDanger?: boolean;
  disabled?: boolean;
}

const Action = ({
  label,
  icon: Icon,
  onAction,
  isActive,
  isDanger,
  disabled,
}: ActionProps) => (
  <Tooltip label={label}>
    <BarButton
      type="button"
      aria-label={label}
      aria-pressed={isActive}
      disabled={disabled}
      $active={isActive}
      $danger={isDanger}
      // Mouse-down would move the caret out of the cell before the action runs,
      // so the action has to happen here instead of on click.
      onMouseDown={(event) => {
        event.preventDefault();
        if (!disabled) onAction();
      }}
    >
      <Icon
        fill={
          disabled
            ? 'neutral300'
            : isDanger
              ? 'danger600'
              : isActive
                ? 'primary600'
                : 'neutral600'
        }
      />
    </BarButton>
  </Tooltip>
);

const ALIGN_ACTIONS: {
  value: TableCellAlign;
  icon: React.ComponentType<{ fill?: string }>;
  id: string;
  defaultMessage: string;
}[] = [
  {
    value: 'left',
    icon: AlignLeftIcon,
    id: 'components.Blocks.table.alignLeft',
    defaultMessage: 'Align cell left',
  },
  {
    value: 'center',
    icon: AlignCenterIcon,
    id: 'components.Blocks.table.alignCenter',
    defaultMessage: 'Align cell center',
  },
  {
    value: 'right',
    icon: AlignRightIcon,
    id: 'components.Blocks.table.alignRight',
    defaultMessage: 'Align cell right',
  },
];

interface TableToolbarProps {
  location: TableLocation;
  disabled: boolean;
}

/**
 * Contextual toolbar that floats above a table while the caret is inside it.
 *
 * Every row/column action is directional and anchored on the focused cell —
 * "insert row above" means above *this* row, not at the end of the table.
 */
const TableToolbar = ({ location, disabled }: TableToolbarProps) => {
  const editor = useSlateStatic();
  const { formatMessage } = useIntl();

  const currentAlign = getCellAlign(location);
  const headerRowOn = hasHeaderRow(location);
  const t = (id: string, defaultMessage: string) =>
    formatMessage({ id, defaultMessage });

  return (
    <Bar contentEditable={false} gap={0} alignItems="center">
      <Action
        label={t('components.Blocks.table.insertRowAbove', 'Insert row above')}
        icon={InsertRowAboveIcon}
        disabled={disabled}
        onAction={() => insertRow(editor, location, 'above')}
      />
      <Action
        label={t('components.Blocks.table.insertRowBelow', 'Insert row below')}
        icon={InsertRowBelowIcon}
        disabled={disabled}
        onAction={() => insertRow(editor, location, 'below')}
      />
      <Action
        label={t('components.Blocks.table.deleteRow', 'Delete row')}
        icon={DeleteRowIcon}
        isDanger
        disabled={disabled || location.rowCount <= 1}
        onAction={() => deleteRow(editor, location)}
      />

      <Separator />

      <Action
        label={t(
          'components.Blocks.table.insertColumnLeft',
          'Insert column left'
        )}
        icon={InsertColumnLeftIcon}
        disabled={disabled}
        onAction={() => insertColumn(editor, location, 'left')}
      />
      <Action
        label={t(
          'components.Blocks.table.insertColumnRight',
          'Insert column right'
        )}
        icon={InsertColumnRightIcon}
        disabled={disabled}
        onAction={() => insertColumn(editor, location, 'right')}
      />
      <Action
        label={t('components.Blocks.table.deleteColumn', 'Delete column')}
        icon={DeleteColumnIcon}
        isDanger
        disabled={disabled || location.colCount <= 1}
        onAction={() => deleteColumn(editor, location)}
      />

      <Separator />

      {ALIGN_ACTIONS.map((action) => (
        <Action
          key={action.value}
          label={t(action.id, action.defaultMessage)}
          icon={action.icon}
          isActive={currentAlign === action.value}
          disabled={disabled}
          onAction={() => setCellAlign(editor, action.value)}
        />
      ))}

      <Separator />

      <Action
        label={t(
          'components.Blocks.table.toggleHeaderRow',
          'Toggle header row'
        )}
        icon={HeaderRowIcon}
        isActive={headerRowOn}
        disabled={disabled}
        onAction={() => toggleHeaderRow(editor, location)}
      />
      <Action
        label={t('components.Blocks.table.deleteTable', 'Delete table')}
        icon={Trash}
        isDanger
        disabled={disabled}
        onAction={() => deleteTable(editor, location)}
      />
    </Bar>
  );
};

export { TableToolbar };
