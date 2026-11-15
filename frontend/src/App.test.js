import React from 'react';
import { render, screen } from '@testing-library/react';
import GameHub from './features/gameHub/GameHub';

test('game hub keeps Like Duel and exposes the Imposter game entry', () => {
  render(
    <GameHub
      onOnlineDuel={() => {}}
      onBotGame={() => {}}
      onImposter={() => {}}
    />
  );
  expect(screen.getByText('Like Duel')).toBeInTheDocument();
  expect(screen.getByText('Imposter')).toBeInTheDocument();
});
