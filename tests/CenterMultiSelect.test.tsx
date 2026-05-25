// @vitest-environment jsdom
/**
 * QUAL-024: CenterMultiSelect component behavior tests.
 *
 * Assertions:
 * (a) Renders one toggle per option.
 * (b) Clicking an unselected option adds it (calls onChange with next array).
 * (c) Clicking a selected option removes it (calls onChange without it).
 * (d) A "clear" affordance resets selected to [].
 * (e) Shows count indicator when >0 centers selected.
 * (f) Empty selected array = no-filter (all) state.
 *
 * RTL: no jest-dom — use queryByText().not.toBeNull() / .toBeNull() per CLAUDE.md.
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CenterMultiSelect } from '../src/components/common/CenterMultiSelect';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OPTIONS = ['Aachen', 'Chemnitz', 'Greifswald'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CenterMultiSelect', () => {
  it('renders one toggle per option', () => {
    const { queryByText } = render(
      <CenterMultiSelect options={OPTIONS} selected={[]} onChange={vi.fn()} />,
    );
    expect(queryByText('Aachen')).not.toBeNull();
    expect(queryByText('Chemnitz')).not.toBeNull();
    expect(queryByText('Greifswald')).not.toBeNull();
  });

  it('clicking an unselected option calls onChange with it added', () => {
    const onChange = vi.fn();
    const { queryByText } = render(
      <CenterMultiSelect options={OPTIONS} selected={[]} onChange={onChange} />,
    );
    const aachen = queryByText('Aachen');
    expect(aachen).not.toBeNull();
    fireEvent.click(aachen!);
    expect(onChange).toHaveBeenCalledWith(['Aachen']);
  });

  it('clicking a selected option calls onChange with it removed', () => {
    const onChange = vi.fn();
    const { queryByText } = render(
      <CenterMultiSelect options={OPTIONS} selected={['Aachen', 'Chemnitz']} onChange={onChange} />,
    );
    fireEvent.click(queryByText('Aachen')!);
    expect(onChange).toHaveBeenCalledWith(['Chemnitz']);
  });

  it('shows count indicator when more than zero centers are selected', () => {
    const { queryByText } = render(
      <CenterMultiSelect options={OPTIONS} selected={['Aachen', 'Chemnitz']} onChange={vi.fn()} />,
    );
    // Should show a count like "2" somewhere
    expect(queryByText('2')).not.toBeNull();
  });

  it('clear affordance calls onChange with empty array', () => {
    const onChange = vi.fn();
    const { queryByText } = render(
      <CenterMultiSelect options={OPTIONS} selected={['Aachen']} onChange={onChange} />,
    );
    // The clear button uses t('qualityFilterCentersClear') which mocks to 'qualityFilterCentersClear'
    fireEvent.click(queryByText('qualityFilterCentersClear')!);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('with empty selected shows all-centers label (no active filter)', () => {
    const { queryByText } = render(
      <CenterMultiSelect options={OPTIONS} selected={[]} onChange={vi.fn()} />,
    );
    // t('qualityFilterCentersAll') = 'qualityFilterCentersAll' in mock
    expect(queryByText('qualityFilterCentersAll')).not.toBeNull();
  });

  it('accepts an optional label prop', () => {
    const { queryByText } = render(
      <CenterMultiSelect options={OPTIONS} selected={[]} onChange={vi.fn()} label="My Label" />,
    );
    expect(queryByText('My Label')).not.toBeNull();
  });
});
