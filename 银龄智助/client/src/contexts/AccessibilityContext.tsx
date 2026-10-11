import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface AccessibilityContextValue {
  highContrast: boolean;
  toggleHighContrast: () => void;
  fontSizeLevel: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

const STORAGE_KEY = 'elder_accessibility_settings';

interface StoredSettings {
  highContrast: boolean;
  fontSizeLevel: number;
}

function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as StoredSettings;
    }
  } catch (error) {
    logger.warn('读取无障碍设置失败', error);
  }
  return { highContrast: false, fontSizeLevel: 1 };
}

function saveSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    logger.warn('保存无障碍设置失败', error);
  }
}

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(loadSettings, []);
  const [highContrast, setHighContrast] = useState<boolean>(initial.highContrast);
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(initial.fontSizeLevel);

  const toggleHighContrast = useCallback(() => {
    setHighContrast((prev: boolean) => {
      const next = !prev;
      saveSettings({ highContrast: next, fontSizeLevel });
      logger.info('高对比度模式切换', { highContrast: next });
      return next;
    });
  }, [fontSizeLevel]);

  const increaseFontSize = useCallback(() => {
    setFontSizeLevel((prev: number) => {
      const next = Math.min(3, prev + 1);
      saveSettings({ highContrast, fontSizeLevel: next });
      return next;
    });
  }, [highContrast]);

  const decreaseFontSize = useCallback(() => {
    setFontSizeLevel((prev: number) => {
      const next = Math.max(0, prev - 1);
      saveSettings({ highContrast, fontSizeLevel: next });
      return next;
    });
  }, [highContrast]);

  const value = useMemo<AccessibilityContextValue>(
    () => ({ highContrast, toggleHighContrast, fontSizeLevel, increaseFontSize, decreaseFontSize }),
    [highContrast, toggleHighContrast, fontSizeLevel, increaseFontSize, decreaseFontSize]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      <div
        className={highContrast ? 'elder-high-contrast' : ''}
        data-font-size-level={fontSizeLevel}
      >
        {children}
      </div>
    </AccessibilityContext.Provider>
  );
};

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return ctx;
}
