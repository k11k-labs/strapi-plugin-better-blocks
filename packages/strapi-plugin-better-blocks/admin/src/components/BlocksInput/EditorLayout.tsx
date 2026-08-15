import * as React from 'react';

import {
  Box,
  Flex,
  FocusTrap,
  Portal,
  FlexComponent,
} from '@strapi/design-system';
import { css, styled } from 'styled-components';

import { useBlocksEditorContext } from './BlocksEditor';

const ExpandWrapper = styled<FlexComponent>(Flex)`
  // Background with 20% opacity
  background: ${({ theme }) => `${theme.colors.neutral800}1F`};
`;

interface EditorLayoutProps {
  children: React.ReactNode;
  error?: string;
  onCollapse: () => void;
  disabled: boolean;
  ariaDescriptionId: string;
}

const EditorLayout = ({
  children,
  error,
  disabled,
  onCollapse,
  ariaDescriptionId,
}: EditorLayoutProps) => {
  const { isExpandedMode } = useBlocksEditorContext('editorLayout');

  React.useEffect(() => {
    if (isExpandedMode) {
      document.body.classList.add('lock-body-scroll');
    }

    return () => {
      document.body.classList.remove('lock-body-scroll');
    };
  }, [isExpandedMode]);

  if (isExpandedMode) {
    return (
      <Portal role="dialog" aria-modal={false}>
        <FocusTrap onEscape={onCollapse}>
          <ExpandWrapper
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            zIndex={4}
            justifyContent="center"
            onClick={onCollapse}
          >
            <Box<'div'>
              background="neutral0"
              hasRadius
              shadow="popupShadow"
              overflow="hidden"
              width="90%"
              height="90%"
              onClick={(e) => e.stopPropagation()}
              aria-describedby={ariaDescriptionId}
              position="relative"
            >
              {/* The collapse control lives in the toolbar (top-right), next
                  to where the expand control was clicked. */}
              <Flex height="100%" alignItems="flex-start" direction="column">
                {children}
              </Flex>
            </Box>
          </ExpandWrapper>
        </FocusTrap>
      </Portal>
    );
  }

  return (
    <InputWrapper
      direction="column"
      alignItems="flex-start"
      // height="512px"
      $disabled={disabled}
      $hasError={Boolean(error)}
      style={{ overflowY: 'auto', overflowX: 'hidden' }}
      aria-describedby={ariaDescriptionId}
      position="relative"
    >
      {children}
    </InputWrapper>
  );
};

const InputWrapper = styled<FlexComponent>(Flex)<{
  $disabled?: boolean;
  $hasError?: boolean;
}>`
  border: 1px solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.danger600 : theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  resize: vertical;
  background: ${({ theme }) => theme.colors.neutral0};

  ${({ theme, $hasError = false }) => css`
    outline: none;
    box-shadow: 0;
    transition-property: border-color, box-shadow, fill;
    transition-duration: 0.2s;

    &:focus-within {
      border: 1px solid
        ${$hasError ? theme.colors.danger600 : theme.colors.primary600};
      box-shadow: ${$hasError
          ? theme.colors.danger600
          : theme.colors.primary600}
        0px 0px 0px 2px;
    }
  `}

  ${({ theme, $disabled }) =>
    $disabled
      ? css`
          color: ${theme.colors.neutral600};
          background: ${theme.colors.neutral150};
        `
      : undefined}
`;

export { EditorLayout };
