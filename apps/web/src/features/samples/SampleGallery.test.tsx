import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SampleGallery } from './SampleGallery';
import { samples } from './samples';

describe('SampleGallery', () => {
  it.each(samples)('opens $title in the diagram', ({ id, title }) => {
    render(<SampleGallery />, { wrapper: MemoryRouter });

    expect(screen.getByRole('link', { name: new RegExp(title) })).toHaveAttribute('href', `/app?sample=${id}`);
  });
});
