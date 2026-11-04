import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CraftPanel from './craftPanel';

const blueprint = {
  id: 'bp-test',
  name: 'Test Blueprint',
  description: 'Sample description',
  category: 'mechanical' as const,
  have: 4,
  craft: 0,
  materials: [
    { name: 'Iron Ingot', need: 2, have: 4 },
    { name: 'Wood Handle', need: 2, have: 1 },
  ],
};

describe('CraftPanel', () => {
  it('renders blueprint details and disables craft when materials are insufficient', () => {
    const onAmountChange = jest.fn();
    const onCraft = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <CraftPanel
        blueprint={blueprint}
        amount={1}
        orderExpedite={false}
        onAmountChange={onAmountChange}
        onToggleExpedite={() => {}}
        onCraft={onCraft}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText(/Test Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText(/Craft Amount/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByText(/2\s*\/\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/Insufficient quantity/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Craft Item/i })).toBeDisabled();
  });

  it('calls amount change handlers when plus and minus are clicked', () => {
    const onAmountChange = jest.fn();
    const onCraft = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <CraftPanel
        blueprint={blueprint}
        amount={1}
        orderExpedite={false}
        onAmountChange={onAmountChange}
        onToggleExpedite={() => {}}
        onCraft={onCraft}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '-' }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));

    expect(onAmountChange).toHaveBeenCalledTimes(2);
    expect(onAmountChange).toHaveBeenCalledWith(1);
    expect(onAmountChange).toHaveBeenCalledWith(2);
  });
});
