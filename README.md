This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Backend Inside Next.js (Route Handlers)

This project uses Next.js Route Handlers for backend APIs, so frontend and backend run on the same port.

1. Copy `.env.example` to `.env.local`
2. Set your MongoDB URI in `MONGODB_URI`
3. Run `npm run dev`
4. Test API: `http://localhost:3000/api/health`

### Local image upload endpoint

- Endpoint: `POST /api/upload`
- Content-Type: `multipart/form-data`
- Required field: `image` (file)
- Optional field: `folder` (sub-folder inside `public/uploads`, default `products`)

Uploaded files are saved in your own server at `public/uploads/...` and returned as a URL path (example: `/uploads/products/file.jpg`).

Example:

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "image=@/absolute/path/to/file.jpg" \
  -F "folder=products"
```

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
