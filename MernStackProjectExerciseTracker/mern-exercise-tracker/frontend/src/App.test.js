jest.mock('react-router-dom', () => {
  const React = require('react');

  return {
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    Navigate: ({ to }) => <div data-testid="navigate">{to}</div>,
    Route: () => null,
    Routes: ({ children }) => {
      const firstRoute = React.Children.toArray(children)[0];
      return <div>{firstRoute?.props?.element}</div>;
    },
    useLocation: () => ({ pathname: '/' }),
    useNavigate: () => jest.fn(),
    useParams: () => ({})
  };
}, { virtual: true });

jest.mock('./services/api', () => ({
  fetchSiteSettings: jest.fn(() => Promise.resolve({}))
}));

jest.mock('./components/home.component', () => function MockHome() {
  return <div>XTracker home page</div>;
});

const { render, screen } = require('@testing-library/react');
const App = require('./App').default;

test('renders XTracker home page', () => {
  render(<App />);
  expect(screen.getAllByText(/XTracker/i).length).toBeGreaterThan(0);
});
