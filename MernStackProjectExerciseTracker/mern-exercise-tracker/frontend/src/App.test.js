import { render, screen } from '@testing-library/react';
import App from './App';

test('renders XTracker home page', () => {
  render(<App />);
  expect(screen.getAllByText(/XTracker/i).length).toBeGreaterThan(0);
});
