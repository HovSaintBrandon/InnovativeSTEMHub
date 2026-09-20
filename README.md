# InnovativeSTEMHub

Personal site for Dr. Rose Atieno Mutende — STEM educator and curriculum specialist. Built with Angular.

## Development

```bash
npm install
npm start        # ng serve, http://localhost:4200
npm run build    # production build to dist/innovativestemhub/browser
```

## Deployment

Pushes to `main` trigger `.github/workflows/deploy-gh-pages.yml`, which builds the app and publishes `dist/innovativestemhub/browser` to the `gh-pages` branch (served via GitHub Pages). `public/CNAME` keeps the custom domain (innovativestemhub.com) pointed at Pages.

In the repo's GitHub Pages settings, set the source to the `gh-pages` branch (root).

## Admin area (research, reading list, homepage photo, blog)

The site uses the existing Firebase project for a small admin area at `/admin` (sign in via the "Sign in" link in the footer). One-time setup in the [Firebase console](https://console.firebase.google.com/) for project `rmutende-stem`:

1. **Authentication** → Sign-in method → enable **Email/Password**, then Users → Add user, and create Dr. Mutende's login (email + password). This is the only account that should exist — anyone signed in is treated as an admin.
2. **Storage** → get started, if not already enabled (needed for the homepage photo and blog cover image uploads).
3. **Firestore Database → Rules** → paste in the contents of `firestore.rules` from this repo, and publish.
4. **Storage → Rules** → paste in the contents of `storage.rules` from this repo, and publish.
5. **Firestore Database → Indexes → Composite** → add the two indexes described in `firestore.indexes.json` (`blogComments`: `postId` Ascending + `approved` Ascending; `blogPosts`: `slug` Ascending + `status` Ascending). If this is skipped, the first time a blog post or its comments are loaded, Firestore returns an error in the browser console with a direct link that creates the exact index needed — click it.

Once signed in at `/admin`, Dr. Mutende can update the homepage photo, add/remove current research and books & reads, and write, edit, publish, or unpublish blog posts. Visitor comments on blog posts are held for approval on the Comments tab before they appear publicly.
