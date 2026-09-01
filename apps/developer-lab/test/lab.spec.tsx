import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { createT, defaultLocale, guide, Locale, locales, resolveLocale, TranslationKey, translations } from '../src/i18n.js';

const setItem = vi.fn();
const getItem = vi.fn(() => null);

vi.stubGlobal('localStorage', { getItem, setItem });
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('') })));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

const { default: Lab } = await import('../src/main.js');

function renderLab(container: HTMLElement): Root {
  const root = createRoot(container);
  act(() => { root.render(<Lab />); });
  return root;
}

function click(button: HTMLButtonElement): void {
  act(() => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('i18n dictionary', () => {
  it('keeps every locale keyed identically', () => {
    expect(locales).toEqual(['zh', 'en']);
    const zhKeys = Object.keys(translations.zh) as TranslationKey[];
    for (const locale of locales) {
      expect(Object.keys(translations[locale]).sort()).toEqual([...zhKeys].sort());
    }
    expect(defaultLocale).toBe('zh');
  });

  it('translates each key in both locales', () => {
    for (const key of Object.keys(translations.zh) as TranslationKey[]) {
      expect(createT('zh')(key)).toBe(translations.zh[key]);
      expect(createT('en')(key)).toBe(translations.en[key]);
      expect(createT('zh')(key)).not.toBe('');
    }
  });

  it('resolves stored locale preferences with a Chinese fallback', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('zh')).toBe('zh');
    expect(resolveLocale('fr')).toBe('zh');
    expect(resolveLocale(null)).toBe('zh');
    expect(resolveLocale(undefined)).toBe('zh');
  });

  it('ships five parallel guide steps per locale', () => {
    expect(guide.zh).toHaveLength(5);
    expect(guide.en).toHaveLength(5);
    expect(guide.zh.map((step) => step.title)).toEqual(['登入操作員', '建立或選擇應用', '取得用戶 token', '發佈與查看留言', '完全重置（危險操作）']);
    expect(guide.en.map((step) => step.title)).toEqual(['Sign in operator', 'Create or select an application', 'Issue a member token', 'Post and list comments', 'Full reset (dangerous)']);
  });
});

describe('Lab language switching', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="lab"></div>';
    container = document.getElementById('lab')!;
    getItem.mockReturnValue(null);
    setItem.mockClear();
  });

  it('defaults to Traditional Chinese with the guide visible', () => {
    renderLab(container);
    expect(container.textContent).toContain('使用指南');
    expect(container.textContent).toContain('身份與應用');
    expect(container.textContent).toContain('發給我 token');
    expect(container.textContent).not.toContain('User guide');
  });

  it('switches to English, persists it, and switches back', () => {
    renderLab(container);
    const enButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'EN')!;
    click(enButton);
    expect(container.textContent).toContain('User guide');
    expect(container.textContent).toContain('Identity & application');
    expect(setItem).toHaveBeenCalledWith('comment-lab-locale', 'en');
    const zhButton = [...container.querySelectorAll('button')].find((button) => button.textContent === '中文')!;
    click(zhButton);
    expect(container.textContent).toContain('使用指南');
    expect(setItem).toHaveBeenCalledWith('comment-lab-locale', 'zh');
  });

  it('restores a persisted English preference', () => {
    getItem.mockReturnValue('en');
    renderLab(container);
    expect(container.textContent).toContain('User guide');
  });

  it('falls back to Chinese for unknown stored values', () => {
    getItem.mockReturnValue('fr');
    renderLab(container);
    expect(container.textContent).toContain('使用指南');
  });

  it('collapses and reopens the guide', () => {
    renderLab(container);
    const hideButton = [...container.querySelectorAll('button')].find((button) => button.textContent === '隱藏指南')!;
    click(hideButton);
    expect(container.textContent).not.toContain('獨立的留言空間');
    const showButton = [...container.querySelectorAll('button')].find((button) => button.textContent === '顯示指南')!;
    click(showButton);
    expect(container.textContent).toContain('獨立的留言空間');
  });
});
