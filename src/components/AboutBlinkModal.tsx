import React from 'react';
import { DocumentationModal } from './DocumentationModal';

export interface AboutBlinkModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenStudio?: () => void;
  onOpenPocket?: () => void;
  initialSection?: string;
}

export const AboutBlinkModal: React.FC<AboutBlinkModalProps> = ({
  visible,
  onClose,
  onOpenStudio,
  onOpenPocket,
  initialSection,
}) => {
  return (
    <DocumentationModal
      visible={visible}
      onClose={onClose}
      onOpenStudio={onOpenStudio}
      onOpenPocket={onOpenPocket}
      initialSection={initialSection}
    />
  );
};
