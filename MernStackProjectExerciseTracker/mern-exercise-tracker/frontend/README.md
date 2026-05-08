# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Chatbot and security setup

The chatbot uses Gemini with signed member sessions, typo-tolerant intent handling, member fitness profile context, and admin-managed monthly AI token allowances.

Recommended backend environment variables:

- `GEMINI_API_KEY=your_key_here`
- `GEMINI_MODEL=gemini-2.5-flash`
- `GEMINI_MODEL_FALLBACKS=gemini-2.5-flash-lite`
- `GEMINI_ENABLE_GOOGLE_SEARCH=true`
- `AUTH_TOKEN_SECRET=use_a_long_random_secret`
- `ADMIN_BOOTSTRAP_USERNAME=existing_admin_username` to promote an existing account to admin at startup
- `DEFAULT_AI_MONTHLY_TOKEN_LIMIT=5000` or another non-negative monthly default
- `MAX_AI_MONTHLY_TOKEN_LIMIT=10000` for the admin-settable ceiling
- `AI_TOKEN_LIMIT_INPUT_STEP=500` for the admin dashboard input increment
- `AI_TOKEN_CHARS_RATIO=4` for the rough local token estimate used before Gemini returns usage data
- `CLIENT_URL=https://your-frontend-origin.example` when the API is hosted on a different origin
- `NODE_ENV=production` for deployment

Production startup requires `AUTH_TOKEN_SECRET` to be at least 32 characters. The app requires body weight, height, neck circumference, and waist circumference for personalized coaching, with SI and US unit entry supported in the profile flow. Admins can use `/admin` to review users, update roles, grant AI tokens, publish safe app settings, and manage exercise-related content records. The app also ignores `.env` files by default now, so secrets stay out of source control more easily.

## Render and Vercel deployment

Recommended split deployment:

- Render backend root: `backend`
- Render build command: `npm install`
- Render start command: `npm start`
- Render environment: `NODE_ENV=production`, `ATLAS_URI`, `AUTH_TOKEN_SECRET`, `GEMINI_API_KEY`, optional Gemini settings, `ADMIN_BOOTSTRAP_USERNAME`, `DEFAULT_AI_MONTHLY_TOKEN_LIMIT`, `MAX_AI_MONTHLY_TOKEN_LIMIT`, `AI_TOKEN_LIMIT_INPUT_STEP`, `AI_TOKEN_CHARS_RATIO`, and `CLIENT_URL=https://your-vercel-app.vercel.app`
- Vercel frontend root: repository root
- Vercel build command: the included `vercel.json` uses `CI=false npm run build` so Create React App warnings do not block deployment
- Vercel output directory: `build`
- Vercel environment: `REACT_APP_API_BASE_URL=https://your-render-service.onrender.com`

Before deploying, replace any local `.env` secrets with Render/Vercel environment variables and rotate anything that was shared during development.
