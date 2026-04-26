<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next 16) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Other framework versions to verify

Same warning applies to:

- **Prisma 7** — config now lives in `prisma.config.ts` (not `package.json#prisma`). Schema location, migrations, and runtime adapter API may differ from earlier versions. Check `node_modules/prisma/` and `node_modules/@prisma/client/` docs.
- **Auth.js v5 (next-auth ^5.0.0-beta)** — radically different from NextAuth v4. Cookie names are `authjs.*` (not `next-auth.*`). Config style, adapters, callbacks, and route handlers all changed. Check `node_modules/next-auth/` README.
- **Tailwind CSS v4** — CSS-first config via `@theme` in the entry CSS file. There is no `tailwind.config.js`. Check `node_modules/tailwindcss/`.
- **React 19** — new hooks (`use`, `useActionState`, `useFormStatus`), Server Components stable, Server Actions stable.
