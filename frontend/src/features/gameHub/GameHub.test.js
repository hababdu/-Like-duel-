import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GameHub from './GameHub';

test('shows the available games and upcoming Imposter mode', () => {
  render(<GameHub onOnlineDuel={() => {}} onBotGame={() => {}} onImposter={() => {}} />);
  expect(screen.getByText('Like Duel')).toBeInTheDocument();
  expect(screen.getByText("Bot bilan o'yin")).toBeInTheDocument();
  expect(screen.getByText('Imposter')).toBeInTheDocument();
});

test('routes the selected existing game to its callback', () => {
  const onOnlineDuel = jest.fn();
  render(<GameHub onOnlineDuel={onOnlineDuel} onBotGame={() => {}} onImposter={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Like Duel/i }));
  expect(onOnlineDuel).toHaveBeenCalledTimes(1);
});
