import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ImposterGame from './ImposterGame';

const socket = {
  connected: false,
  on: jest.fn(),
  off: jest.fn(),
  timeout: jest.fn()
};

test('renders Imposter room entry and requires a six-character code', () => {
  render(<ImposterGame socket={socket} user={{ tgId: '12345' }} onBack={() => {}} />);
  expect(screen.getByText('Kim Imposter?')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Yangi xona yaratish/i })).toBeDisabled();
  const input = screen.getByLabelText('Xona kodi');
  fireEvent.change(input, { target: { value: 'AB23CD' } });
  expect(screen.getByRole('button', { name: /Xonaga qo‘shilish/i })).toBeDisabled();
});

test('subscribes to private role and room update events', () => {
  render(<ImposterGame socket={socket} user={{ tgId: '12345' }} onBack={() => {}} />);
  expect(socket.on).toHaveBeenCalledWith('imposter:room_updated', expect.any(Function));
  expect(socket.on).toHaveBeenCalledWith('imposter:private_role', expect.any(Function));
});
